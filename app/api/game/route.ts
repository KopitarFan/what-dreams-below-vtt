import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getDb } from '@/db';
import {
  accountSessions,
  accounts,
  authChallenges,
  authRateLimits,
  boardMarks,
  boardPieces,
  campaignMaps,
  campaignRuntime,
  campaigns,
  gameEvents,
  loot,
  players,
  privateMessages,
  integrationTokens,
  contentImports,
  integrationAssets,
  scenes,
} from '@/db/schema';
import type {
  BoardMark,
  Campaign,
  Character,
  Encounter,
  PieceDetails,
  Session,
  KeeperRuntime,
} from '@/lib/game-types';
import { ensureIntegrationTables, sha256 } from '@/lib/integration-api';
import { type ContentPackage } from '@/lib/content-schema';

export const dynamic = 'force-dynamic';
let keeperTablesReady = false;
async function ensureKeeperTables() {
  if (keeperTablesReady) return;
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS campaign_runtime (campaign_id text PRIMARY KEY NOT NULL, state_json text DEFAULT '{}' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (campaign_id) REFERENCES campaigns(id)); CREATE TABLE IF NOT EXISTS private_messages (id text PRIMARY KEY NOT NULL, campaign_id text NOT NULL, player_id text NOT NULL, sender text NOT NULL, message text NOT NULL, created_at integer NOT NULL, FOREIGN KEY (campaign_id) REFERENCES campaigns(id), FOREIGN KEY (player_id) REFERENCES players(id)); CREATE INDEX IF NOT EXISTS idx_private_messages_player ON private_messages (campaign_id, player_id);",
  );
  keeperTablesReady = true;
}
const unreality = [
  'The old acquaintance: a stranger warmly recalls experiences you shared.',
  'The missing week: receipts prove you were in Los Angeles before you remember arriving.',
  'The wrong reflection: it wears an injury you do not have.',
  'The familiar address: someone there recognizes you.',
  'The extra photograph: you appear in a picture taken before your birth.',
  'The revised landmark: everyone remembers a door that was never there.',
  'The absent person: the city has forgotten someone important.',
  'The double memory: both versions of a private conversation left evidence.',
  'The local habit: you perform a small ritual you never learned.',
  'The voice beneath: a radio predicts your next few seconds.',
  'The route home: your key opens a residence you have never seen.',
  'Keeper’s omen: a concrete detail points toward one of the seven families.',
];
const lootTable = [
  {
    name: 'Monogrammed silver cigarette case',
    description:
      'Initials have been filed away; a train-platform locker number is scratched inside.',
    category: 'clue',
    value: '$18',
  },
  {
    name: 'Police evidence envelope',
    description:
      'Sealed, dated tomorrow, and containing a key dusted with pale green sand.',
    category: 'clue',
    value: 'Evidence',
  },
  {
    name: 'Black opal signet ring',
    description:
      'A Veranda family crest surrounds a stone that stays warm after sunset.',
    category: 'valuable',
    value: '$120',
  },
  {
    name: 'Nickel-plated pocket pistol',
    description:
      'A compact .25 automatic with one full magazine and no serial number.',
    category: 'weapon',
    value: '$22',
  },
  {
    name: 'Funeral-home ledger',
    description:
      'Lists six burials that never occurred and one investigator as next of kin.',
    category: 'occult',
    value: 'Dangerous',
  },
  {
    name: 'Brass streetcar token',
    description: 'Stamped for a line removed from city maps in 1911.',
    category: 'clue',
    value: 'Unpriced',
  },
  {
    name: 'Laudanum and field dressing',
    description:
      'A battered medical pouch; useful, legal only with questions, and nearly expired.',
    category: 'supply',
    value: '$6',
  },
  {
    name: 'Ivory-handled ritual knife',
    description:
      'Ceremonial rather than practical. The blade reflects a room from the wrong angle.',
    category: 'occult',
    value: 'Unpriced',
  },
  {
    name: 'Roll of mixed bills',
    description: 'Twenty-three dollars wrapped around a hotel claim ticket.',
    category: 'valuable',
    value: '$23',
  },
  {
    name: 'Glass photographic plate',
    description:
      'When held to light, it shows a figure standing behind the photographer.',
    category: 'clue',
    value: 'Evidence',
  },
];
const encounterParts = {
  hooks: [
    'A payphone rings with a message meant for someone dead',
    'A frightened witness mistakes an investigator for an old accomplice',
    'A routine police cordon seals the only safe route',
    'A streetcar arrives empty except for a freshly printed newspaper',
    'A trusted contact fails to give the agreed signal',
  ],
  opposition: [
    'two nervous hired guns protecting the wrong door',
    'a corrupt detective and an observant patrolman',
    'a cult courier who will flee rather than fight',
    'a wounded creature moving through walls and reflections',
    'an influential socialite with three loyal attendants',
  ],
  clues: [
    'a receipt links the scene to a familiar address',
    'the opposition carries a photograph of the investigators',
    'a repeated symbol identifies one of the conspiracy’s fronts',
    'an ordinary object bears an impossible date',
    'a witness remembers a smell and a phrase, but no face',
  ],
  complications: [
    'the authorities arrive in three rounds',
    'an innocent bystander recognizes the least reputable investigator',
    'the lights fail and every exit appears to lead downstairs',
    'the opposition offers information in exchange for immediate help',
    'success exposes a trusted NPC to retaliation',
  ],
  stakes: [
    'Gain a lead before it is moved or destroyed',
    'Protect a contact without revealing the investigation',
    'Choose between stopping the threat and preserving the evidence',
    'Escape without becoming the official suspects',
    'Learn who is giving orders before the opposition realizes what it knows',
  ],
};

function code() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((n) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32])
    .join('');
}
function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
function clean(value: unknown, max = 120) {
  const text =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? String(value)
      : '';
  return text.trim().slice(0, max);
}
function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function randomItem<T>(items: T[]) {
  return items[crypto.getRandomValues(new Uint32Array(1))[0] % items.length];
}
function percentile(target: number, bonusPenalty = 0) {
  const ones = Math.floor(Math.random() * 10),
    tens = Array.from({ length: Math.abs(bonusPenalty) + 1 }, () =>
      Math.floor(Math.random() * 10),
    ),
    values = tens.map((t) => {
      const n = t * 10 + ones;
      return n === 0 ? 100 : n;
    }),
    roll =
      bonusPenalty < 0
        ? Math.min(...values)
        : bonusPenalty > 0
          ? Math.max(...values)
          : values[0];
  const outcome =
    roll === 1
      ? 'Critical Success'
      : (roll >= 96 && target < 50) || roll === 100
        ? 'Fumble'
        : roll <= Math.floor(target / 5)
          ? 'Extreme Success'
          : roll <= Math.floor(target / 2)
            ? 'Hard Success'
            : roll <= target
              ? 'Success'
              : 'Failure';
  return { roll, outcome, tens, ones };
}
function successRank(outcome: string) {
  return outcome === 'Critical Success'
    ? 5
    : outcome === 'Extreme Success'
      ? 4
      : outcome === 'Hard Success'
        ? 3
        : outcome === 'Success'
          ? 2
          : outcome === 'Failure'
            ? 1
            : 0;
}

const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;
function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}
async function valueHash(value: string) {
  const bits = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64(new Uint8Array(bits));
}
function requestToken(
  request: NextRequest,
  body?: Record<string, unknown> | null,
) {
  return request.cookies.get('veil_session')?.value || clean(body?.token, 100);
}
function setSessionCookie(
  response: NextResponse,
  token: string,
  request: NextRequest,
) {
  response.cookies.set('veil_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
function clearSessionCookie(response: NextResponse) {
  response.cookies.set('veil_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  });
  return response;
}
async function issueSession(accountId: string) {
  const token = id('account_session'),
    expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  await getDb()
    .insert(accountSessions)
    .values({ token, accountId, expiresAt, createdAt: Date.now() });
  return token;
}
async function rateLimit(key: string, limit: number, windowMs: number) {
  const db = getDb(),
    now = Date.now(),
    row = await db
      .select()
      .from(authRateLimits)
      .where(eq(authRateLimits.key, key))
      .get();
  if (!row || now - row.windowStart >= windowMs) {
    if (row)
      await db
        .update(authRateLimits)
        .set({ windowStart: now, count: 1 })
        .where(eq(authRateLimits.key, key));
    else
      await db
        .insert(authRateLimits)
        .values({ key, windowStart: now, count: 1 });
    return false;
  }
  if (row.count >= limit) return true;
  await db
    .update(authRateLimits)
    .set({ count: row.count + 1 })
    .where(eq(authRateLimits.key, key));
  return false;
}
async function issueChallenge(accountId: string, kind: 'verify' | 'reset') {
  const code = String(
    crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
  ).padStart(6, '0');
  await getDb()
    .insert(authChallenges)
    .values({
      id: id('challenge'),
      accountId,
      kind,
      codeHash: await valueHash(code),
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0,
      consumedAt: null,
      createdAt: Date.now(),
    });
  return code;
}
async function consumeChallenge(
  accountId: string,
  kind: 'verify' | 'reset',
  code: string,
) {
  const db = getDb(),
    row = await db
      .select()
      .from(authChallenges)
      .where(
        and(
          eq(authChallenges.accountId, accountId),
          eq(authChallenges.kind, kind),
          isNull(authChallenges.consumedAt),
        ),
      )
      .orderBy(desc(authChallenges.createdAt))
      .get();
  if (!row || row.expiresAt < Date.now() || row.attempts >= 5) return false;
  const valid = (await valueHash(code)) === row.codeHash;
  await db
    .update(authChallenges)
    .set(valid ? { consumedAt: Date.now() } : { attempts: row.attempts + 1 })
    .where(eq(authChallenges.id, row.id));
  return valid;
}
function isLocal(request: NextRequest) {
  return (
    request.nextUrl.hostname === 'localhost' ||
    request.nextUrl.hostname === '127.0.0.1'
  );
}
async function accountAuth(token: string) {
  if (!token) return null;
  const now = Date.now();
  const db = getDb();
  const row = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      displayName: accounts.displayName,
      expiresAt: accountSessions.expiresAt,
    })
    .from(accountSessions)
    .innerJoin(accounts, eq(accountSessions.accountId, accounts.id))
    .where(eq(accountSessions.token, token))
    .get();
  return row && row.expiresAt > now ? row : null;
}
async function dashboard(accountId: string) {
  const db = getDb();
  const owned = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.keeperAccountId, accountId))
    .all();
  const joined = await db
    .select({
      playerId: players.id,
      campaignId: campaigns.id,
      name: campaigns.name,
      year: campaigns.year,
      location: campaigns.location,
      status: campaigns.status,
      sessionNumber: campaigns.sessionNumber,
      characterJson: players.characterJson,
      characterStatus: players.characterStatus,
    })
    .from(players)
    .innerJoin(campaigns, eq(players.campaignId, campaigns.id))
    .where(eq(players.accountId, accountId))
    .all();
  return [
    ...owned.map((c) => ({
      campaignId: c.id,
      name: c.name,
      year: c.year,
      location: c.location,
      status: c.status,
      sessionNumber: c.sessionNumber,
      role: 'keeper' as const,
      playerId: null,
      characterName: null,
    })),
    ...joined.map((p) => ({
      campaignId: p.campaignId,
      name: p.name,
      year: p.year,
      location: p.location,
      status: p.status,
      sessionNumber: p.sessionNumber,
      role: 'player' as const,
      playerId: p.playerId,
      characterName:
        p.characterJson && p.characterStatus === 'final'
          ? (JSON.parse(p.characterJson) as Character).name
          : null,
    })),
  ];
}

async function auth(token: string) {
  const db = getDb();
  const keeper = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.keeperToken, token))
    .get();
  if (keeper)
    return {
      role: 'keeper' as const,
      campaignId: keeper.id,
      displayName: 'Keeper',
    };
  const player = await db
    .select()
    .from(players)
    .where(eq(players.playerToken, token))
    .get();
  if (player)
    return {
      role: 'player' as const,
      campaignId: player.campaignId,
      playerId: player.id,
      displayName: player.name,
    };
  return null;
}

async function snapshot(
  campaignId: string,
  viewerPlayerId?: string,
  isKeeper = false,
): Promise<Campaign | null> {
  await ensureKeeperTables();
  await ensureIntegrationTables();
  const db = getDb();
  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .get();
  if (!campaign) return null;
  const memberRows = await db
    .select()
    .from(players)
    .where(eq(players.campaignId, campaignId))
    .all();
  const pieceRows = await db
    .select()
    .from(boardPieces)
    .where(eq(boardPieces.campaignId, campaignId))
    .all();
  const eventRows = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.campaignId, campaignId))
    .orderBy(desc(gameEvents.createdAt))
    .limit(80)
    .all();
  const sceneRows = isKeeper
    ? await db
        .select()
        .from(scenes)
        .where(eq(scenes.campaignId, campaignId))
        .orderBy(scenes.sortOrder)
        .all()
    : [];
  const lootRows = isKeeper
    ? await db
        .select()
        .from(loot)
        .where(eq(loot.campaignId, campaignId))
        .orderBy(desc(loot.createdAt))
        .all()
    : viewerPlayerId
      ? await db
          .select()
          .from(loot)
          .where(
            and(
              eq(loot.campaignId, campaignId),
              eq(loot.assignedPlayerId, viewerPlayerId),
            ),
          )
          .orderBy(desc(loot.createdAt))
          .all()
      : [];
  const mapRows = await db
    .select()
    .from(campaignMaps)
    .where(eq(campaignMaps.campaignId, campaignId))
    .orderBy(desc(campaignMaps.createdAt))
    .all();
  const markRows = await db
    .select()
    .from(boardMarks)
    .where(eq(boardMarks.campaignId, campaignId))
    .all();
  const runtimeRow = await db
    .select()
    .from(campaignRuntime)
    .where(eq(campaignRuntime.campaignId, campaignId))
    .get();
  const storedRuntime = runtimeRow ? JSON.parse(runtimeRow.stateJson) : {};
  const runtime: KeeperRuntime = {
    combat: storedRuntime.combat || {
      active: false,
      round: 1,
      turnIndex: 0,
      order: [],
    },
    handouts: storedRuntime.handouts || [],
  };
  const messageRows = viewerPlayerId
    ? await db
        .select()
        .from(privateMessages)
        .where(
          and(
            eq(privateMessages.campaignId, campaignId),
            eq(privateMessages.playerId, viewerPlayerId),
          ),
        )
        .orderBy(desc(privateMessages.createdAt))
        .limit(30)
        .all()
    : [];
  const importRows = isKeeper
    ? await db
        .select()
        .from(contentImports)
        .where(eq(contentImports.campaignId, campaignId))
        .orderBy(desc(contentImports.createdAt))
        .all()
    : [];
  const tokenRows = isKeeper
    ? await db
        .select()
        .from(integrationTokens)
        .where(eq(integrationTokens.campaignId, campaignId))
        .orderBy(desc(integrationTokens.createdAt))
        .all()
    : [];
  const assetRows = isKeeper
    ? await db
        .select()
        .from(integrationAssets)
        .where(eq(integrationAssets.campaignId, campaignId))
        .orderBy(desc(integrationAssets.createdAt))
        .all()
    : [];
  return {
    id: campaign.id,
    name: campaign.name,
    joinCode: isKeeper ? campaign.joinCode : '',
    year: campaign.year,
    location: campaign.location,
    status: campaign.status,
    sessionNumber: campaign.sessionNumber,
    sceneTitle: campaign.sceneTitle,
    sceneDescription: campaign.sceneDescription,
    playerNotes:
      memberRows.find((p) => p.id === viewerPlayerId)?.notesMarkdown ?? '',
    players: memberRows.map((p) => ({
      id: p.id,
      name: p.name,
      character:
        p.characterJson &&
        (p.characterStatus === 'final' || p.id === viewerPlayerId)
          ? JSON.parse(p.characterJson)
          : null,
      characterStatus:
        p.characterStatus === 'draft' ? ('draft' as const) : ('final' as const),
      tokenUrl: p.tokenKey
        ? `/api/token?playerId=${encodeURIComponent(p.id)}`
        : null,
      x: p.x,
      y: p.y,
      onBoard: p.onBoard,
    })),
    pieces: pieceRows
      .filter((p) => isKeeper || !p.hidden)
      .map(({ detailsJson, ...piece }) => ({
        ...piece,
        details: isKeeper ? JSON.parse(detailsJson || '{}') : {},
      })),
    events: eventRows.reverse().map((e) => ({
      id: e.id,
      actor: e.actor,
      kind: e.kind,
      message: e.message,
      createdAt: e.createdAt,
      payload: e.payloadJson ? JSON.parse(e.payloadJson) : undefined,
    })),
    scenes: sceneRows.map((s) => ({
      id: s.id,
      chapter: s.chapter,
      title: s.title,
      description: s.description,
      objective: s.objective,
      clues: s.clues,
      keeperNotes: s.keeperNotes,
      status: s.status,
      sortOrder: s.sortOrder,
    })),
    loot: lootRows,
    maps: mapRows.map((m) => ({
      id: m.id,
      name: m.name,
      url: `/api/map?id=${encodeURIComponent(m.id)}`,
      isCurrent: m.isCurrent,
      createdAt: m.createdAt,
    })),
    marks: markRows
      .filter((m) => isKeeper || !m.hidden)
      .map((m) => ({
        id: m.id,
        kind: m.kind as BoardMark['kind'],
        data: JSON.parse(m.dataJson),
        hidden: m.hidden,
      })),
    runtime: isKeeper
      ? runtime
      : { ...runtime, handouts: runtime.handouts.filter((h) => h.revealed) },
    privateMessages: messageRows.reverse().map((m) => ({
      id: m.id,
      sender: m.sender,
      message: m.message,
      createdAt: m.createdAt,
    })),
    imports: importRows.map((r) => {
      const p = JSON.parse(r.packageJson) as ContentPackage;
      return {
        id: r.id,
        title: r.title,
        source: r.source,
        status: r.status,
        createdAt: r.createdAt,
        contents: {
          scenes: p.scenes.length,
          cast: p.cast.length,
          handouts: p.handouts.length,
          encounters: p.encounters.length,
        },
      };
    }),
    integrationTokens: tokenRows.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      scopes: t.scopes.split(','),
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      revoked: Boolean(t.revokedAt),
    })),
    integrationAssets: assetRows.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      createdAt: asset.createdAt,
      url: `/api/v1/assets/${encodeURIComponent(asset.id)}`,
    })),
  };
}

async function saveRuntime(campaignId: string, state: KeeperRuntime) {
  await getDb()
    .insert(campaignRuntime)
    .values({
      campaignId,
      stateJson: JSON.stringify(state),
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: campaignRuntime.campaignId,
      set: { stateJson: JSON.stringify(state), updatedAt: Date.now() },
    });
}

async function log(
  campaignId: string,
  actor: string,
  kind: string,
  message: string,
  payload?: unknown,
) {
  await getDb()
    .insert(gameEvents)
    .values({
      id: id('event'),
      campaignId,
      actor,
      kind,
      message,
      payloadJson: payload ? JSON.stringify(payload) : null,
      createdAt: Date.now(),
    });
}

export async function GET(request: NextRequest) {
  const token = requestToken(request, {
      token: request.nextUrl.searchParams.get('token') ?? '',
    }),
    campaignId = request.nextUrl.searchParams.get('campaignId') ?? '';
  const account = await accountAuth(token);
  if (account) {
    const memberships = await dashboard(account.id);
    const membership = campaignId
      ? memberships.find((m) => m.campaignId === campaignId)
      : null;
    if (campaignId && !membership)
      return error('You do not have access to that campaign.', 403);
    const session: Session = {
      token: '',
      accountId: account.id,
      email: account.email,
      displayName: account.displayName,
      role: membership?.role ?? null,
      campaignId: membership?.campaignId ?? null,
      playerId: membership?.playerId ?? undefined,
    };
    return NextResponse.json({
      session,
      memberships,
      campaign: membership
        ? await snapshot(
            membership.campaignId,
            membership.playerId ?? undefined,
            membership.role === 'keeper',
          )
        : null,
    });
  }
  const identity = await auth(token);
  if (!identity) return error('Session not found.', 401);
  return NextResponse.json({
    session: { ...identity, token } satisfies Session,
    campaign: await snapshot(
      identity.campaignId,
      identity.playerId,
      identity.role === 'keeper',
    ),
    memberships: [],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return error('Invalid request.');
  const action = clean(body.action, 40);
  const db = getDb();
  const clientKey =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'local';
  if (action === 'register' || action === 'login') {
    const email = clean(body.email, 120).toLowerCase(),
      password = typeof body.password === 'string' ? body.password : '',
      displayName = clean(body.displayName, 60);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
      return error(
        'Enter a valid email and a password of at least 8 characters.',
      );
    if (
      await rateLimit(
        `${action}:${clientKey}:${email}`,
        action === 'login' ? 10 : 5,
        action === 'login' ? 15 * 60 * 1000 : 60 * 60 * 1000,
      )
    )
      return error('Too many attempts. Please wait before trying again.', 429);
    let account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .get();
    if (action === 'register') {
      if (account) return error('An account already uses that email.', 409);
      if (displayName.length < 2)
        return error('Enter the name you use at the table.');
      const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(18)));
      account = {
        id: id('account'),
        email,
        displayName,
        passwordSalt: salt,
        passwordHash: await passwordHash(password, salt),
        emailVerifiedAt: Date.now(),
        createdAt: Date.now(),
      };
      await db.insert(accounts).values(account);
    } else {
      if (
        !account ||
        (await passwordHash(password, account.passwordSalt)) !==
          account.passwordHash
      )
        return error('Email or password is incorrect.', 401);
    }
    const token = await issueSession(account.id);
    const session: Session = {
      token: '',
      accountId: account.id,
      email: account.email,
      displayName: account.displayName,
      role: null,
      campaignId: null,
    };
    return setSessionCookie(
      NextResponse.json({
        session,
        memberships: await dashboard(account.id),
        campaign: null,
      }),
      token,
      request,
    );
  }
  if (action === 'verifyEmail') {
    const email = clean(body.email, 120).toLowerCase(),
      code = clean(body.code, 6),
      account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .get();
    if (!account || !(await consumeChallenge(account.id, 'verify', code)))
      return error('That verification code is invalid or expired.', 400);
    await db
      .update(accounts)
      .set({ emailVerifiedAt: Date.now() })
      .where(eq(accounts.id, account.id));
    const token = await issueSession(account.id);
    const session: Session = {
      token: '',
      accountId: account.id,
      email: account.email,
      displayName: account.displayName,
      role: null,
      campaignId: null,
    };
    return setSessionCookie(
      NextResponse.json({
        session,
        memberships: await dashboard(account.id),
        campaign: null,
      }),
      token,
      request,
    );
  }
  if (action === 'forgotPassword') {
    const email = clean(body.email, 120).toLowerCase();
    if (await rateLimit(`forgot:${clientKey}:${email}`, 5, 60 * 60 * 1000))
      return error('Too many requests. Please wait before trying again.', 429);
    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .get();
    const developmentCode = account
      ? await issueChallenge(account.id, 'reset')
      : undefined;
    return NextResponse.json({
      ok: true,
      email,
      developmentCode: isLocal(request) ? developmentCode : undefined,
      message: 'If that account exists, a reset code has been sent.',
    });
  }
  if (action === 'resetPassword') {
    const email = clean(body.email, 120).toLowerCase(),
      code = clean(body.code, 6),
      password = typeof body.password === 'string' ? body.password : '',
      account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .get();
    if (password.length < 8)
      return error('Use a password of at least 8 characters.');
    if (!account || !(await consumeChallenge(account.id, 'reset', code)))
      return error('That reset code is invalid or expired.', 400);
    const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(18)));
    await db
      .update(accounts)
      .set({
        passwordSalt: salt,
        passwordHash: await passwordHash(password, salt),
      })
      .where(eq(accounts.id, account.id));
    await db
      .delete(accountSessions)
      .where(eq(accountSessions.accountId, account.id));
    const token = await issueSession(account.id);
    const session: Session = {
      token: '',
      accountId: account.id,
      email: account.email,
      displayName: account.displayName,
      role: null,
      campaignId: null,
    };
    return setSessionCookie(
      NextResponse.json({
        session,
        memberships: await dashboard(account.id),
        campaign: null,
      }),
      token,
      request,
    );
  }
  if (action === 'logout') {
    const token = requestToken(request, body);
    if (token)
      await db.delete(accountSessions).where(eq(accountSessions.token, token));
    return clearSessionCookie(NextResponse.json({ ok: true }));
  }
  const account = await accountAuth(requestToken(request, body));
  if (action === 'createCampaign') {
    if (!account) return error('Sign in to create a campaign.', 401);
    const name = clean(body.name, 80);
    if (name.length < 3)
      return error('Campaign name must be at least 3 characters.');
    const campaignId = id('campaign'),
      keeperToken = id('keeper'),
      joinCode = code(),
      now = Date.now();
    await db.insert(campaigns).values({
      id: campaignId,
      name,
      joinCode,
      keeperToken,
      keeperAccountId: account.id,
      year: clean(body.year, 4) || '1926',
      location: clean(body.location, 80) || 'Los Angeles County',
      status: 'lobby',
      sessionNumber: 0,
      sceneTitle: 'An empty table',
      sceneDescription: 'Set the opening scene when your investigators arrive.',
      createdAt: now,
      updatedAt: now,
    });
    await log(
      campaignId,
      'Keeper',
      'campaign',
      `Campaign “${name}” was created.`,
    );
    const session: Session = {
      role: 'keeper',
      token: '',
      accountId: account.id,
      email: account.email,
      campaignId,
      displayName: account.displayName,
    };
    return NextResponse.json({
      session,
      campaign: await snapshot(campaignId, undefined, true),
      memberships: await dashboard(account.id),
    });
  }
  if (action === 'createSampleCampaign') {
    if (!account) return error('Sign in to create a campaign.', 401);
    const campaignId = id('campaign'),
      keeperToken = id('keeper'),
      joinCode = code(),
      now = Date.now();
    await db.insert(campaigns).values({
      id: campaignId,
      name: 'The City That Dreams Below',
      joinCode,
      keeperToken,
      keeperAccountId: account.id,
      year: '1926',
      location: 'Los Angeles County',
      status: 'live',
      sessionNumber: 1,
      sceneTitle: 'The Last Yellow Car',
      sceneDescription:
        'Near midnight, a Yellow Car stands motionless on rain-black tracks. Its doors are open, its conductor is missing, and no two clocks aboard show the same time.',
      createdAt: now,
      updatedAt: now,
    });
    const evelyn: Character = {
      name: 'Evelyn Shaw',
      occupation: 'Investigative Journalist',
      age: 31,
      residence: 'Echo Park',
      str: 45,
      con: 55,
      siz: 50,
      dex: 65,
      app: 60,
      int: 75,
      pow: 60,
      edu: 70,
      luck: 55,
      hp: 10,
      sanity: 60,
      mp: 12,
      credit: 35,
      anchor:
        'Her younger brother Daniel, who still believes the truth matters.',
      connection: 'Jack once pulled her from a burning newsroom archive.',
      secret: 'She buried evidence to protect a source who later disappeared.',
    };
    const jack: Character = {
      name: 'Jack Moretti',
      occupation: 'Private Investigator',
      age: 38,
      residence: 'Bunker Hill',
      str: 60,
      con: 65,
      siz: 60,
      dex: 55,
      app: 45,
      int: 70,
      pow: 55,
      edu: 60,
      luck: 40,
      hp: 12,
      sanity: 55,
      mp: 11,
      credit: 30,
      anchor:
        'The battered office where his late partner’s name remains on the glass.',
      connection:
        'Evelyn knows why he left the police and has never printed it.',
      secret: 'He accepted Veranda money to lose a case five years ago.',
    };
    await db.insert(players).values([
      {
        id: id('player'),
        campaignId,
        name: 'Sample Player — Evelyn',
        playerToken: id('session'),
        characterJson: JSON.stringify(evelyn),
        x: 35,
        y: 61,
        onBoard: true,
        joinedAt: now,
      },
      {
        id: id('player'),
        campaignId,
        name: 'Sample Player — Jack',
        playerToken: id('session'),
        characterJson: JSON.stringify(jack),
        x: 44,
        y: 68,
        onBoard: true,
        joinedAt: now + 1,
      },
    ]);
    await db.insert(boardPieces).values([
      {
        id: id('piece'),
        campaignId,
        name: 'Beatrice Vale',
        kind: 'npc',
        initials: 'BV',
        x: 64,
        y: 42,
        hp: null,
        maxHp: null,
        hidden: false,
      },
      {
        id: id('piece'),
        campaignId,
        name: 'Tomás Navarro',
        kind: 'npc',
        initials: 'TN',
        x: 71,
        y: 56,
        hp: null,
        maxHp: null,
        hidden: false,
      },
      {
        id: id('piece'),
        campaignId,
        name: 'Quiet Choir Enforcer',
        kind: 'mob',
        initials: 'QC',
        x: 78,
        y: 70,
        hp: 11,
        maxHp: 11,
        hidden: false,
      },
      {
        id: id('piece'),
        campaignId,
        name: 'Drowned Revenant',
        kind: 'mob',
        initials: 'DR',
        x: 58,
        y: 73,
        hp: 14,
        maxHp: 14,
        hidden: false,
      },
      {
        id: id('piece'),
        campaignId,
        name: 'Faceless Conductor',
        kind: 'mob',
        initials: 'FC',
        x: 66,
        y: 65,
        hp: 12,
        maxHp: 12,
        hidden: false,
      },
    ]);
    await log(
      campaignId,
      'Keeper',
      'campaign',
      'Sample campaign generated with two investigators, two NPCs, and three threats.',
    );
    await log(
      campaignId,
      'Keeper',
      'scene',
      'The Yellow Car waits at the end of the line. Its interior lamps are still burning.',
    );
    await log(
      campaignId,
      'Evelyn Shaw',
      'roll',
      'Spot Hidden: 27 / 65 — Hard Success.',
    );
    await log(
      campaignId,
      'Keeper',
      'clue',
      'Every clock aboard shows a different time. One passenger has been dead for eleven years.',
    );
    const session: Session = {
      role: 'keeper',
      token: '',
      accountId: account.id,
      email: account.email,
      campaignId,
      displayName: account.displayName,
    };
    return NextResponse.json({
      session,
      campaign: await snapshot(campaignId, undefined, true),
      memberships: await dashboard(account.id),
    });
  }
  if (action === 'joinCampaign') {
    if (!account) return error('Sign in to join a campaign.', 401);
    const joinCode = clean(body.joinCode, 6).toUpperCase(),
      name = clean(body.name, 50);
    if (!joinCode || !name) return error('Enter a join code and your name.');
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.joinCode, joinCode))
      .get();
    if (!campaign) return error('No campaign uses that code.', 404);
    const existing = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.campaignId, campaign.id),
          eq(players.accountId, account.id),
        ),
      )
      .get();
    if (existing) return error('Your account is already in this campaign.');
    const playerId = id('player'),
      playerToken = id('session');
    await db.insert(players).values({
      id: playerId,
      campaignId: campaign.id,
      name: name || account.displayName,
      playerToken,
      accountId: account.id,
      characterStatus: 'draft',
      joinedAt: Date.now(),
    });
    const session: Session = {
      role: 'player',
      token: '',
      accountId: account.id,
      email: account.email,
      campaignId: campaign.id,
      playerId,
      displayName: account.displayName,
    };
    return NextResponse.json({
      session,
      campaign: await snapshot(campaign.id, playerId),
      memberships: await dashboard(account.id),
    });
  }
  const token = requestToken(request, body);
  let identity: Awaited<ReturnType<typeof auth>> | null = null;
  if (account) {
    const campaignId = clean(body.campaignId, 100);
    const memberships = await dashboard(account.id);
    const membership = memberships.find((m) => m.campaignId === campaignId);
    if (membership)
      identity =
        membership.role === 'player' && membership.playerId
          ? {
              role: 'player',
              campaignId: membership.campaignId,
              playerId: membership.playerId,
              displayName: account.displayName,
            }
          : {
              role: 'keeper',
              campaignId: membership.campaignId,
              displayName: account.displayName,
            };
  } else identity = await auth(token);
  if (!identity)
    return error(
      'Your session has expired or the campaign is unavailable.',
      401,
    );
  const campaignId = identity.campaignId;
  await ensureKeeperTables();
  await ensureIntegrationTables();
  if (action === 'saveCharacter' || action === 'saveCharacterDraft') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players create investigators.', 403);
    const c = body.character as Character;
    const isDraft = action === 'saveCharacterDraft';
    if (
      (!isDraft && !c) ||
      (!isDraft &&
        (clean(c.name, 60).length < 2 ||
          clean(c.occupation, 60).length < 2 ||
          clean(c.anchor, 600).length < 2))
    )
      return error('Name, occupation, and sanity anchor are required.');
    if (!c) return error('Character data is required.');
    const skills = Object.fromEntries(
      Object.entries(c.skills || {})
        .slice(0, 80)
        .map(([key, value]) => [
          clean(key, 40),
          Math.max(0, Math.min(99, Number(value) || 0)),
        ])
        .filter(([key]) => Boolean(key)),
    );
    const customSkills = (c.customSkills || [])
      .slice(0, 30)
      .map((s) => ({
        id: clean(s.id, 80) || id('skill'),
        name: clean(s.name, 80),
        base: Math.max(0, Math.min(99, Number(s.base) || 0)),
        value: Math.max(0, Math.min(99, Number(s.value) || 0)),
      }))
      .filter((s) => s.name);
    const weapons = (c.weapons || [])
      .slice(0, 20)
      .map((w) => ({
        id: clean(w.id, 80) || id('weapon'),
        name: clean(w.name, 80),
        skillKey: clean(w.skillKey, 80),
        skillName: clean(w.skillName, 80),
        damage: clean(w.damage, 40),
        range: clean(w.range, 60),
        attacks: clean(w.attacks, 20),
        ammo: Math.max(0, Math.min(999, Number(w.ammo) || 0)),
        maxAmmo: Math.max(0, Math.min(999, Number(w.maxAmmo) || 0)),
        malfunction: Math.max(0, Math.min(100, Number(w.malfunction) || 0)),
      }))
      .filter((w) => w.name);
    const episodes = (c.sanityEpisodes || [])
      .slice(0, 30)
      .map((e) => ({
        id: clean(e.id, 80) || id('episode'),
        kind: ['bout', 'phobia', 'mania', 'indefinite'].includes(e.kind)
          ? e.kind
          : ('bout' as const),
        name: clean(e.name, 100),
        notes: clean(e.notes, 300),
      }))
      .filter((e) => e.name);
    const backstory = {
      appearance: clean(c.backstory?.appearance, 600),
      ideology: clean(c.backstory?.ideology, 600),
      significantPeople: clean(c.backstory?.significantPeople, 600),
      meaningfulLocations: clean(c.backstory?.meaningfulLocations, 600),
      treasuredPossessions: clean(c.backstory?.treasuredPossessions, 600),
      traits: clean(c.backstory?.traits, 600),
    };
    const safe = {
      ...c,
      name: clean(c.name, 60),
      occupation: clean(c.occupation, 60),
      residence: clean(c.residence, 80),
      anchor: clean(c.anchor, 600),
      connection: clean(c.connection, 600),
      secret: clean(c.secret, 600),
      possessions: clean(c.possessions, 3000),
      skills,
      customSkills,
      weapons,
      sanityEpisodes: episodes,
      backstory,
      conditions: (c.conditions || []).slice(0, 12).map((v) => clean(v, 40)),
      improvementMarks: (c.improvementMarks || [])
        .slice(0, 100)
        .map((v) => clean(v, 80)),
      occupationSkillKeys: (c.occupationSkillKeys || [])
        .slice(0, 30)
        .map((v) => clean(v, 80)),
      modifiers: (c.modifiers || []).slice(0, 30).map((m) => ({
        id: clean(m.id, 80) || id('modifier'),
        name: clean(m.name, 100),
        target: clean(m.target, 80),
        amount: Math.max(-99, Math.min(99, Number(m.amount) || 0)),
        expires: clean(m.expires, 100),
      })),
      spells: (c.spells || []).slice(0, 30).map((s) => ({
        id: clean(s.id, 80) || id('spell'),
        name: clean(s.name, 100),
        cost: clean(s.cost, 60),
        castingTime: clean(s.castingTime, 80),
        description: clean(s.description, 800),
        sanityCost: clean(s.sanityCost, 60),
      })),
      tomes: (c.tomes || []).slice(0, 20).map((t) => ({
        id: clean(t.id, 80) || id('tome'),
        title: clean(t.title, 120),
        language: clean(t.language, 80),
        studyTime: clean(t.studyTime, 80),
        mythosGain: clean(t.mythosGain, 60),
        sanityLoss: clean(t.sanityLoss, 60),
        spells: clean(t.spells, 500),
        notes: clean(t.notes, 1000),
      })),
      chase: c.chase
        ? {
            speed: Math.max(0, Math.min(99, Number(c.chase.speed) || 0)),
            actionPoints: Math.max(
              0,
              Math.min(20, Number(c.chase.actionPoints) || 0),
            ),
            location: clean(c.chase.location, 120),
            vehicle: clean(c.chase.vehicle, 120),
            vehicleBuild: Math.max(
              -10,
              Math.min(20, Number(c.chase.vehicleBuild) || 0),
            ),
            notes: clean(c.chase.notes, 500),
          }
        : undefined,
    };
    const existingPlayer = await db
      .select({
        characterJson: players.characterJson,
        characterStatus: players.characterStatus,
      })
      .from(players)
      .where(eq(players.id, identity.playerId))
      .get();
    await db
      .update(players)
      .set({
        characterJson: JSON.stringify(safe),
        characterStatus: isDraft ? 'draft' : 'final',
        onBoard: isDraft ? false : true,
      })
      .where(eq(players.id, identity.playerId));
    if (!isDraft)
      await log(
        campaignId,
        identity.displayName,
        'character',
        existingPlayer?.characterStatus === 'final'
          ? `${safe.name}'s dossier was updated.`
          : `${safe.name}, ${safe.occupation}, entered the investigation.`,
      );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
    });
  }
  if (action === 'saveNotes') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players can edit private notes.', 403);
    const notes =
      typeof body.notes === 'string' ? body.notes.slice(0, 50000) : '';
    await db
      .update(players)
      .set({ notesMarkdown: notes })
      .where(
        and(
          eq(players.id, identity.playerId),
          eq(players.campaignId, campaignId),
        ),
      );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
    });
  }
  if (action === 'uploadToken') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players can upload their investigator token.', 403);
    const dataUrl = typeof body.image === 'string' ? body.image : '';
    const match = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
      dataUrl,
    );
    if (!match)
      return error('Token processing produced an unsupported image format.');
    const format = match[1],
      binary = atob(match[2]);
    if (binary.length > 2000000) return error('Token image is too large.');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const key = `tokens/${identity.playerId}`;
    await env.TOKEN_IMAGES.put(key, bytes, {
      httpMetadata: {
        contentType: `image/${format}`,
        cacheControl: 'private, max-age=0',
      },
    });
    await db
      .update(players)
      .set({ tokenKey: key })
      .where(
        and(
          eq(players.id, identity.playerId),
          eq(players.campaignId, campaignId),
        ),
      );
    await log(
      campaignId,
      identity.displayName,
      'character',
      'Updated their investigator token.',
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
    });
  }
  if (action === 'createIntegrationToken') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const name = clean(body.name, 80) || 'Creative tools',
      raw = `wdb_${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`,
      prefix = raw.slice(0, 12),
      tokenId = id('integration');
    await db.insert(integrationTokens).values({
      id: tokenId,
      campaignId,
      name,
      prefix,
      tokenHash: await sha256(raw),
      scopes: 'context:read,imports:write,assets:write',
      createdAt: Date.now(),
    });
    await log(
      campaignId,
      'Keeper',
      'integration',
      `Created integration token “${name}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
      token: raw,
    });
  }
  if (action === 'revokeIntegrationToken') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const tokenId = clean(body.tokenId, 100);
    await db
      .update(integrationTokens)
      .set({ revokedAt: Date.now() })
      .where(
        and(
          eq(integrationTokens.id, tokenId),
          eq(integrationTokens.campaignId, campaignId),
        ),
      );
    await log(
      campaignId,
      'Keeper',
      'integration',
      'Revoked a campaign integration token.',
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'deleteImport') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const importId = clean(body.importId, 100),
      item = await db
        .select()
        .from(contentImports)
        .where(
          and(
            eq(contentImports.id, importId),
            eq(contentImports.campaignId, campaignId),
          ),
        )
        .get();
    if (!item) return error('Import not found.', 404);
    await db.delete(contentImports).where(eq(contentImports.id, importId));
    await log(
      campaignId,
      'Keeper',
      'import',
      `Rejected staged import “${item.title}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'approveIntegrationAsset') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const assetId = clean(body.assetId, 100);
    const asset = await db
      .select()
      .from(integrationAssets)
      .where(
        and(
          eq(integrationAssets.id, assetId),
          eq(integrationAssets.campaignId, campaignId),
        ),
      )
      .get();
    if (!asset) return error('Asset not found.', 404);
    await db
      .update(integrationAssets)
      .set({ status: 'approved', approvedAt: Date.now() })
      .where(eq(integrationAssets.id, assetId));
    await log(
      campaignId,
      'Keeper',
      'integration',
      `Approved generated ${asset.kind} “${asset.name}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'deleteIntegrationAsset') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const assetId = clean(body.assetId, 100);
    const asset = await db
      .select()
      .from(integrationAssets)
      .where(
        and(
          eq(integrationAssets.id, assetId),
          eq(integrationAssets.campaignId, campaignId),
        ),
      )
      .get();
    if (!asset) return error('Asset not found.', 404);
    await env.TOKEN_IMAGES.delete(asset.objectKey);
    await db.delete(integrationAssets).where(eq(integrationAssets.id, assetId));
    await log(
      campaignId,
      'Keeper',
      'integration',
      `Deleted generated ${asset.kind} “${asset.name}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'approveImport') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const importId = clean(body.importId, 100),
      item = await db
        .select()
        .from(contentImports)
        .where(
          and(
            eq(contentImports.id, importId),
            eq(contentImports.campaignId, campaignId),
          ),
        )
        .get();
    if (!item) return error('Import not found.', 404);
    if (item.status !== 'pending')
      return error('This import has already been reviewed.');
    const pack = JSON.parse(item.packageJson) as ContentPackage,
      now = Date.now();
    let sort =
      (
        await db
          .select({ sortOrder: scenes.sortOrder })
          .from(scenes)
          .where(eq(scenes.campaignId, campaignId))
          .orderBy(desc(scenes.sortOrder))
          .get()
      )?.sortOrder ?? -1;
    for (const s of pack.scenes)
      await db.insert(scenes).values({
        id: id('scene'),
        campaignId,
        chapter: s.chapter,
        title: s.title,
        description: s.description,
        objective: s.objective,
        clues: s.clues.join('\n'),
        keeperNotes: s.keeperNotes,
        status: 'planned',
        sortOrder: ++sort,
        createdAt: now,
        updatedAt: now,
      });
    for (const p of pack.cast) {
      const initials = p.name
          .split(/\s+/)
          .map((v) => v[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        details = {
          description: p.description,
          motivation: p.motivation,
          hook: p.hook,
          ...p.stats,
        };
      await db.insert(boardPieces).values({
        id: id('piece'),
        campaignId,
        name: p.name,
        kind: p.kind,
        initials,
        x: 55 + (crypto.getRandomValues(new Uint8Array(1))[0] % 20),
        y: 35 + (crypto.getRandomValues(new Uint8Array(1))[0] % 25),
        hp: p.hp,
        maxHp: p.hp,
        hidden: p.hidden,
        detailsJson: JSON.stringify(details),
      });
    }
    const row = await db
        .select()
        .from(campaignRuntime)
        .where(eq(campaignRuntime.campaignId, campaignId))
        .get(),
      runtime: KeeperRuntime = row
        ? JSON.parse(row.stateJson)
        : {
            combat: { active: false, round: 1, turnIndex: 0, order: [] },
            handouts: [],
          };
    runtime.handouts = runtime.handouts || [];
    runtime.handouts.push(
      ...pack.handouts.map((h) => ({
        id: id('handout'),
        title: h.title,
        body: h.body,
        revealed: h.revealed,
        createdAt: now,
      })),
    );
    await saveRuntime(campaignId, runtime);
    for (const e of pack.encounters)
      await log(
        campaignId,
        'IMPORT',
        'encounter',
        `Imported encounter “${e.title}”: ${e.hook} Opposition: ${e.opposition} Clue: ${e.clue} Complication: ${e.complication}`,
      );
    await db
      .update(contentImports)
      .set({ status: 'approved', approvedAt: now })
      .where(eq(contentImports.id, importId));
    await log(
      campaignId,
      'Keeper',
      'import',
      `Approved “${pack.title}”: ${pack.scenes.length} scenes, ${pack.cast.length} cast, ${pack.handouts.length} handouts, ${pack.encounters.length} encounters.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'startSession') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const current = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .get();
    if (!current) return error('Campaign missing.', 404);
    const next = current.status === 'live' ? 'paused' : 'live';
    const number =
      current.sessionNumber || next === 'live'
        ? Math.max(1, current.sessionNumber)
        : current.sessionNumber;
    await db
      .update(campaigns)
      .set({ status: next, sessionNumber: number, updatedAt: Date.now() })
      .where(eq(campaigns.id, campaignId));
    await log(
      campaignId,
      'Keeper',
      'session',
      next === 'live'
        ? `Session ${number} began.`
        : `Session ${number} paused.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'setScene') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const title = clean(body.title, 80),
      description = clean(body.description, 220);
    if (!title) return error('Scene title is required.');
    await db
      .update(campaigns)
      .set({
        sceneTitle: title,
        sceneDescription: description,
        updatedAt: Date.now(),
      })
      .where(eq(campaigns.id, campaignId));
    await log(campaignId, 'Keeper', 'scene', `Scene changed to “${title}”.`);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'addNpc') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const name = clean(body.name, 60);
    if (!name) return error('NPC name is required.');
    const initials = name
      .split(/\s+/)
      .map((v) => v[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const kind = body.kind === 'mob' ? 'mob' : 'npc';
    await db.insert(boardPieces).values({
      id: id('piece'),
      campaignId,
      name,
      kind,
      initials,
      x: 55 + Math.floor(Math.random() * 20),
      y: 35 + Math.floor(Math.random() * 25),
      hp: kind === 'mob' ? 10 : null,
      maxHp: kind === 'mob' ? 10 : null,
      hidden: false,
      detailsJson: '{}',
    });
    await log(campaignId, 'Keeper', 'piece', `${name} was added to the board.`);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'saveScene') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const sceneId = clean(body.sceneId, 100),
      title = clean(body.title, 100),
      chapter = clean(body.chapter, 60) || 'Chapter 1',
      status = ['planned', 'active', 'complete'].includes(String(body.status))
        ? String(body.status)
        : 'planned';
    if (!title) return error('Scene title is required.');
    const values = {
      chapter,
      title,
      description: clean(body.description, 1000),
      objective: clean(body.objective, 500),
      clues: clean(body.clues, 2000),
      keeperNotes: clean(body.keeperNotes, 4000),
      status,
      updatedAt: Date.now(),
    };
    const targetSceneId = sceneId || id('scene');
    if (sceneId) {
      const existing = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.id, sceneId), eq(scenes.campaignId, campaignId)))
        .get();
      if (!existing) return error('Scene not found.', 404);
      await db.update(scenes).set(values).where(eq(scenes.id, sceneId));
    } else {
      const last = await db
        .select({ sortOrder: scenes.sortOrder })
        .from(scenes)
        .where(eq(scenes.campaignId, campaignId))
        .orderBy(desc(scenes.sortOrder))
        .get();
      await db.insert(scenes).values({
        id: targetSceneId,
        campaignId,
        ...values,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdAt: Date.now(),
      });
    }
    if (status === 'active') {
      const activeRows = await db
        .select({ id: scenes.id })
        .from(scenes)
        .where(
          and(eq(scenes.campaignId, campaignId), eq(scenes.status, 'active')),
        )
        .all();
      for (const row of activeRows) {
        if (row.id !== targetSceneId)
          await db
            .update(scenes)
            .set({ status: 'planned', updatedAt: Date.now() })
            .where(eq(scenes.id, row.id));
      }
      await db
        .update(campaigns)
        .set({
          sceneTitle: title,
          sceneDescription: values.description,
          updatedAt: Date.now(),
        })
        .where(eq(campaigns.id, campaignId));
    }
    await log(
      campaignId,
      'Keeper',
      'scene',
      `${sceneId ? 'Updated' : 'Created'} scene “${title}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'savePiece') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const pieceId = clean(body.pieceId, 100),
      name = clean(body.name, 80),
      kind = body.kind === 'mob' ? 'mob' : 'npc';
    if (!name)
      return error(`${kind === 'mob' ? 'MOB' : 'NPC'} name is required.`);
    const raw = (
      body.details && typeof body.details === 'object' ? body.details : {}
    ) as Record<string, unknown>;
    const details: PieceDetails = {
      occupation: clean(raw.occupation, 80),
      description: clean(raw.description, 500),
      motivation: clean(raw.motivation, 300),
      hook: clean(raw.hook, 500),
      secret: clean(raw.secret, 500),
      str: Number(raw.str) || undefined,
      con: Number(raw.con) || undefined,
      siz: Number(raw.siz) || undefined,
      dex: Number(raw.dex) || undefined,
      app: Number(raw.app) || undefined,
      int: Number(raw.int) || undefined,
      pow: Number(raw.pow) || undefined,
      fighting: Number(raw.fighting) || undefined,
      damage: clean(raw.damage, 80),
      armor: clean(raw.armor, 100),
      sanityLoss: clean(raw.sanityLoss, 80),
      attacks: clean(raw.attacks, 500),
      notes: clean(raw.notes, 2000),
    };
    const hp = Math.max(0, Math.min(999, Number(body.hp) || 0)),
      initials = name
        .split(/\s+/)
        .map((v) => v[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      values = {
        name,
        kind,
        initials,
        hp: hp || null,
        maxHp: hp || null,
        hidden: Boolean(body.hidden),
        detailsJson: JSON.stringify(details),
      };
    if (pieceId) {
      const existing = await db
        .select()
        .from(boardPieces)
        .where(
          and(
            eq(boardPieces.id, pieceId),
            eq(boardPieces.campaignId, campaignId),
          ),
        )
        .get();
      if (!existing) return error('Cast member not found.', 404);
      await db
        .update(boardPieces)
        .set(values)
        .where(eq(boardPieces.id, pieceId));
    } else
      await db.insert(boardPieces).values({
        id: id('piece'),
        campaignId,
        ...values,
        x: 55 + (crypto.getRandomValues(new Uint8Array(1))[0] % 20),
        y: 35 + (crypto.getRandomValues(new Uint8Array(1))[0] % 25),
      });
    await log(
      campaignId,
      'Keeper',
      'piece',
      `${pieceId ? 'Updated' : 'Created'} ${kind === 'mob' ? 'threat' : 'NPC'} “${name}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'deletePiece') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const pieceId = clean(body.pieceId, 100);
    const piece = await db
      .select()
      .from(boardPieces)
      .where(
        and(
          eq(boardPieces.id, pieceId),
          eq(boardPieces.campaignId, campaignId),
        ),
      )
      .get();
    if (!piece) return error('Cast member not found.', 404);
    await db
      .delete(boardPieces)
      .where(
        and(
          eq(boardPieces.id, pieceId),
          eq(boardPieces.campaignId, campaignId),
        ),
      );
    await log(
      campaignId,
      'Keeper',
      'piece',
      `Removed ${piece.kind === 'mob' ? 'threat' : 'NPC'} “${piece.name}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'generateLoot') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const item = randomItem(lootTable),
      lootId = id('loot');
    await db.insert(loot).values({
      id: lootId,
      campaignId,
      ...item,
      assignedPlayerId: null,
      createdAt: Date.now(),
    });
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
      loot: item,
    });
  }
  if (action === 'grantLoot') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const lootId = clean(body.lootId, 100),
      playerId = clean(body.playerId, 100);
    const item = await db
        .select()
        .from(loot)
        .where(and(eq(loot.id, lootId), eq(loot.campaignId, campaignId)))
        .get(),
      player = await db
        .select()
        .from(players)
        .where(
          and(eq(players.id, playerId), eq(players.campaignId, campaignId)),
        )
        .get();
    if (!item || !player) return error('Choose a valid item and investigator.');
    await db
      .update(loot)
      .set({ assignedPlayerId: playerId })
      .where(eq(loot.id, lootId));
    await log(
      campaignId,
      'Keeper',
      'loot',
      `Granted ${item.name} to ${player.characterJson ? (JSON.parse(player.characterJson) as Character).name : player.name}.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'deleteLoot') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const lootId = clean(body.lootId, 100);
    const item = await db
      .select()
      .from(loot)
      .where(and(eq(loot.id, lootId), eq(loot.campaignId, campaignId)))
      .get();
    if (!item) return error('Loot not found.', 404);
    await db
      .delete(loot)
      .where(and(eq(loot.id, lootId), eq(loot.campaignId, campaignId)));
    await log(
      campaignId,
      'Keeper',
      'loot',
      `Removed ${item.name} from the campaign inventory.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'generateEncounter') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const prompt = clean(body.prompt, 160);
    const encounter: Encounter = {
      title: prompt || 'Trouble beneath the city lights',
      hook: randomItem(encounterParts.hooks),
      opposition: randomItem(encounterParts.opposition),
      clue: randomItem(encounterParts.clues),
      complication: randomItem(encounterParts.complications),
      stakes: randomItem(encounterParts.stakes),
      difficulty: randomItem([
        'Regular for improvised opposition',
        'Hard when facing a trained professional',
        'Hard, with one bonus die for strong preparation',
        'Extreme only for the central hidden threat',
      ]),
      sanityLoss: randomItem([
        'None unless the impossible is revealed',
        '0/1D3 for a disturbing manifestation',
        '1/1D4 for direct unnatural violence',
        '1/1D6 if the hidden truth becomes undeniable',
      ]),
    };
    await log(
      campaignId,
      'Keeper',
      'encounter',
      `Generated encounter: ${encounter.title}.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
      encounter,
    });
  }
  if (action === 'togglePlayerBoard') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const playerId = clean(body.playerId, 100),
      target = await db
        .select()
        .from(players)
        .where(
          and(eq(players.id, playerId), eq(players.campaignId, campaignId)),
        )
        .get();
    if (!target) return error('Investigator not found.', 404);
    await db
      .update(players)
      .set({ onBoard: !target.onBoard })
      .where(eq(players.id, playerId));
    await log(
      campaignId,
      'Keeper',
      'board',
      `${target.name} was ${target.onBoard ? 'removed from' : 'added to'} the map.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'startCombat') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const memberRows = await db
        .select()
        .from(players)
        .where(
          and(eq(players.campaignId, campaignId), eq(players.onBoard, true)),
        )
        .all(),
      pieceRows = await db
        .select()
        .from(boardPieces)
        .where(eq(boardPieces.campaignId, campaignId))
        .all();
    const order = [
      ...memberRows
        .filter((p) => p.characterJson)
        .map((p) => {
          const c = JSON.parse(p.characterJson!) as Character;
          return {
            id: p.id,
            type: 'player' as const,
            name: c.name,
            initiative: c.dex,
            hp: c.hp,
            maxHp: c.maxHp || Math.floor((c.con + c.siz) / 10),
            hidden: false,
          };
        }),
      ...pieceRows.map((p) => {
        const d = JSON.parse(p.detailsJson || '{}') as PieceDetails;
        return {
          id: p.id,
          type: 'piece' as const,
          name: p.name,
          initiative: Number(d.dex) || 0,
          hp: p.hp,
          maxHp: p.maxHp,
          hidden: p.hidden,
        };
      }),
    ].sort((a, b) => b.initiative - a.initiative);
    const state: KeeperRuntime = {
      combat: { active: true, round: 1, turnIndex: 0, order },
      handouts:
        ((await db
          .select()
          .from(campaignRuntime)
          .where(eq(campaignRuntime.campaignId, campaignId))
          .get())
          ? JSON.parse(
              (await db
                .select()
                .from(campaignRuntime)
                .where(eq(campaignRuntime.campaignId, campaignId))
                .get())!.stateJson,
            ).handouts
          : []) || [],
    };
    await saveRuntime(campaignId, state);
    await log(
      campaignId,
      'Keeper',
      'combat',
      `Combat began with ${order.length} participants. ${order[0]?.name || 'No one'} acts first.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (
    action === 'advanceCombat' ||
    action === 'endCombat' ||
    action === 'setInitiative'
  ) {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const row = await db
        .select()
        .from(campaignRuntime)
        .where(eq(campaignRuntime.campaignId, campaignId))
        .get(),
      state: KeeperRuntime = row
        ? JSON.parse(row.stateJson)
        : {
            combat: { active: false, round: 1, turnIndex: 0, order: [] },
            handouts: [],
          };
    if (action === 'endCombat') {
      state.combat.active = false;
      await log(
        campaignId,
        'Keeper',
        'combat',
        `Combat ended after round ${state.combat.round}.`,
      );
    } else if (action === 'setInitiative') {
      const entryId = clean(body.entryId, 100),
        initiative = Math.max(0, Math.min(999, Number(body.initiative) || 0));
      state.combat.order = state.combat.order
        .map((e) => (e.id === entryId ? { ...e, initiative } : e))
        .sort((a, b) => b.initiative - a.initiative);
      state.combat.turnIndex = 0;
    } else if (state.combat.order.length) {
      state.combat.turnIndex++;
      if (state.combat.turnIndex >= state.combat.order.length) {
        state.combat.turnIndex = 0;
        state.combat.round++;
      }
      await log(
        campaignId,
        'Keeper',
        'combat',
        `Round ${state.combat.round}: ${state.combat.order[state.combat.turnIndex]?.name} takes the turn.`,
      );
    }
    await saveRuntime(campaignId, state);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (
    action === 'saveHandout' ||
    action === 'toggleHandout' ||
    action === 'deleteHandout'
  ) {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const row = await db
        .select()
        .from(campaignRuntime)
        .where(eq(campaignRuntime.campaignId, campaignId))
        .get(),
      state: KeeperRuntime = row
        ? JSON.parse(row.stateJson)
        : {
            combat: { active: false, round: 1, turnIndex: 0, order: [] },
            handouts: [],
          },
      handoutId = clean(body.handoutId, 100);
    if (action === 'saveHandout') {
      const title = clean(body.title, 100),
        handout = {
          id: id('handout'),
          title,
          body: clean(body.body, 5000),
          revealed: Boolean(body.revealed),
          createdAt: Date.now(),
        };
      if (!title) return error('Handout title is required.');
      state.handouts.push(handout);
      await log(
        campaignId,
        'Keeper',
        'handout',
        `${handout.revealed ? 'Revealed' : 'Prepared'} handout “${title}”.`,
      );
    } else if (action === 'toggleHandout') {
      state.handouts = state.handouts.map((h) =>
        h.id === handoutId ? { ...h, revealed: !h.revealed } : h,
      );
      const h = state.handouts.find((h) => h.id === handoutId);
      if (h)
        await log(
          campaignId,
          'Keeper',
          'handout',
          `${h.revealed ? 'Revealed' : 'Hid'} handout “${h.title}”.`,
        );
    } else state.handouts = state.handouts.filter((h) => h.id !== handoutId);
    await saveRuntime(campaignId, state);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'privateMessage') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const playerId = clean(body.playerId, 100),
      message = clean(body.message, 1000),
      target = await db
        .select()
        .from(players)
        .where(
          and(eq(players.id, playerId), eq(players.campaignId, campaignId)),
        )
        .get();
    if (!target || !message)
      return error('Choose a player and write a message.');
    await db.insert(privateMessages).values({
      id: id('whisper'),
      campaignId,
      playerId,
      sender: 'Keeper',
      message,
      createdAt: Date.now(),
    });
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
      ok: true,
    });
  }
  if (action === 'togglePieceHidden') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const pieceId = clean(body.pieceId, 100),
      piece = await db
        .select()
        .from(boardPieces)
        .where(
          and(
            eq(boardPieces.id, pieceId),
            eq(boardPieces.campaignId, campaignId),
          ),
        )
        .get();
    if (!piece) return error('Piece not found.', 404);
    await db
      .update(boardPieces)
      .set({ hidden: !piece.hidden })
      .where(eq(boardPieces.id, pieceId));
    await log(
      campaignId,
      'Keeper',
      'board',
      `${piece.name} is now ${piece.hidden ? 'visible' : 'hidden'}.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'adjustStat') {
    const targetType = body.targetType === 'piece' ? 'piece' : 'player',
      targetId = clean(body.targetId, 100),
      stat = ['hp', 'sanity', 'mp', 'luck'].includes(String(body.stat))
        ? String(body.stat)
        : 'hp',
      delta = Math.max(-99, Math.min(99, Number(body.delta) || 0));
    if (targetType === 'piece') {
      if (identity.role !== 'keeper')
        return error('Keeper access required.', 403);
      const piece = await db
        .select()
        .from(boardPieces)
        .where(
          and(
            eq(boardPieces.id, targetId),
            eq(boardPieces.campaignId, campaignId),
          ),
        )
        .get();
      if (!piece) return error('Piece not found.', 404);
      const next = Math.max(
        0,
        Math.min(piece.maxHp || 999, (piece.hp || 0) + delta),
      );
      await db
        .update(boardPieces)
        .set({ hp: next })
        .where(eq(boardPieces.id, targetId));
      await log(
        campaignId,
        'Keeper',
        'stat',
        `${piece.name} HP ${delta >= 0 ? '+' : ''}${delta} → ${next}.`,
      );
    } else {
      if (identity.role === 'player' && identity.playerId !== targetId)
        return error('You can only adjust your own investigator.', 403);
      const target = await db
        .select()
        .from(players)
        .where(
          and(eq(players.id, targetId), eq(players.campaignId, campaignId)),
        )
        .get();
      if (!target?.characterJson) return error('Investigator not found.', 404);
      const character = JSON.parse(target.characterJson) as Character;
      const current = Number(character[stat as keyof Character]) || 0;
      const next = Math.max(0, Math.min(999, current + delta));
      (character as unknown as Record<string, unknown>)[stat] = next;
      await db
        .update(players)
        .set({ characterJson: JSON.stringify(character) })
        .where(eq(players.id, targetId));
      await log(
        campaignId,
        identity.role === 'keeper' ? 'Keeper' : identity.displayName,
        'stat',
        `${character.name} ${stat.toUpperCase()} ${delta >= 0 ? '+' : ''}${delta} → ${next}.`,
      );
    }
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
    });
  }
  if (action === 'uploadMap') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const dataUrl = typeof body.image === 'string' ? body.image : '',
      name = clean(body.name, 100) || 'Untitled map',
      match = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
        dataUrl,
      );
    if (!match) return error('Choose a PNG, JPG, or WebP map.');
    const binary = atob(match[2]);
    if (binary.length > 10000000)
      return error('Map must be smaller than 10 MB.');
    const mapId = id('map'),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const key = `maps/${campaignId}/${mapId}`;
    await env.TOKEN_IMAGES.put(key, bytes, {
      httpMetadata: {
        contentType: `image/${match[1]}`,
        cacheControl: 'private, max-age=0',
      },
    });
    const existing = await db
      .select()
      .from(campaignMaps)
      .where(eq(campaignMaps.campaignId, campaignId))
      .get();
    await db.insert(campaignMaps).values({
      id: mapId,
      campaignId,
      name,
      objectKey: key,
      contentType: `image/${match[1]}`,
      isCurrent: !existing,
      createdAt: Date.now(),
    });
    await log(campaignId, 'Keeper', 'map', `Uploaded map “${name}”.`);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'replaceMap') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const mapId = clean(body.mapId, 100),
      map = await db
        .select()
        .from(campaignMaps)
        .where(
          and(
            eq(campaignMaps.id, mapId),
            eq(campaignMaps.campaignId, campaignId),
          ),
        )
        .get();
    if (!map) return error('Map not found.', 404);
    const dataUrl = typeof body.image === 'string' ? body.image : '',
      name = clean(body.name, 100) || map.name,
      match = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
        dataUrl,
      );
    if (!match) return error('Choose a PNG, JPG, or WebP map.');
    const binary = atob(match[2]);
    if (binary.length > 10000000)
      return error('Map must be smaller than 10 MB.');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    await env.TOKEN_IMAGES.put(map.objectKey, bytes, {
      httpMetadata: {
        contentType: `image/${match[1]}`,
        cacheControl: 'private, max-age=0',
      },
    });
    await db
      .update(campaignMaps)
      .set({ name, contentType: `image/${match[1]}` })
      .where(eq(campaignMaps.id, mapId));
    await log(campaignId, 'Keeper', 'map', `Replaced map “${map.name}”.`);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'setCurrentMap') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const mapId = clean(body.mapId, 100),
      map = await db
        .select()
        .from(campaignMaps)
        .where(
          and(
            eq(campaignMaps.id, mapId),
            eq(campaignMaps.campaignId, campaignId),
          ),
        )
        .get();
    if (!map) return error('Map not found.', 404);
    await db
      .update(campaignMaps)
      .set({ isCurrent: false })
      .where(eq(campaignMaps.campaignId, campaignId));
    await db
      .update(campaignMaps)
      .set({ isCurrent: true })
      .where(eq(campaignMaps.id, mapId));
    await log(
      campaignId,
      'Keeper',
      'map',
      `Changed the current map to “${map.name}”.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'deleteMap') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const mapId = clean(body.mapId, 100),
      map = await db
        .select()
        .from(campaignMaps)
        .where(
          and(
            eq(campaignMaps.id, mapId),
            eq(campaignMaps.campaignId, campaignId),
          ),
        )
        .get();
    if (!map) return error('Map not found.', 404);
    await env.TOKEN_IMAGES.delete(map.objectKey);
    await db.delete(campaignMaps).where(eq(campaignMaps.id, mapId));
    if (map.isCurrent) {
      const next = await db
        .select()
        .from(campaignMaps)
        .where(eq(campaignMaps.campaignId, campaignId))
        .orderBy(desc(campaignMaps.createdAt))
        .get();
      if (next)
        await db
          .update(campaignMaps)
          .set({ isCurrent: true })
          .where(eq(campaignMaps.id, next.id));
    }
    await log(campaignId, 'Keeper', 'map', `Deleted map “${map.name}”.`);
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'addMark') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const kind = [
        'freehand',
        'line',
        'ruler',
        'rect',
        'circle',
        'sticker',
        'fog',
      ].includes(String(body.kind))
        ? String(body.kind)
        : 'line',
      data = body.data && typeof body.data === 'object' ? body.data : {};
    await db.insert(boardMarks).values({
      id: id('mark'),
      campaignId,
      kind,
      dataJson: JSON.stringify(data).slice(0, 12000),
      hidden: Boolean(body.hidden),
      createdAt: Date.now(),
    });
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'clearMarks') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    await db.delete(boardMarks).where(eq(boardMarks.campaignId, campaignId));
    await log(
      campaignId,
      'Keeper',
      'board',
      'Cleared the drawings and stickers from the map.',
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
    });
  }
  if (action === 'move') {
    const targetId = clean(body.targetId, 80),
      x = Math.max(3, Math.min(97, Number(body.x) || 50)),
      y = Math.max(5, Math.min(95, Number(body.y) || 50)),
      targetType = body.targetType;
    if (targetType === 'player') {
      if (identity.role === 'player' && identity.playerId !== targetId)
        return error('You can only move your own investigator.', 403);
      await db
        .update(players)
        .set({ x: Math.round(x), y: Math.round(y) })
        .where(
          and(eq(players.id, targetId), eq(players.campaignId, campaignId)),
        );
    } else {
      if (identity.role !== 'keeper')
        return error('Only the Keeper can move NPCs.', 403);
      await db
        .update(boardPieces)
        .set({ x: Math.round(x), y: Math.round(y) })
        .where(
          and(
            eq(boardPieces.id, targetId),
            eq(boardPieces.campaignId, campaignId),
          ),
        );
    }
    return NextResponse.json({ ok: true });
  }
  if (action === 'moveMany') {
    const raw = Array.isArray(body.moves) ? body.moves.slice(0, 50) : [];
    if (!raw.length) return error('No tokens selected.');
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const move = item as Record<string, unknown>,
        targetId = clean(move.targetId, 80),
        targetType = move.targetType,
        x = Math.max(3, Math.min(97, Number(move.x) || 50)),
        y = Math.max(5, Math.min(95, Number(move.y) || 50));
      if (targetType === 'player') {
        if (identity.role === 'player' && identity.playerId !== targetId)
          return error('You can only move your own investigator.', 403);
        await db
          .update(players)
          .set({ x: Math.round(x), y: Math.round(y) })
          .where(
            and(eq(players.id, targetId), eq(players.campaignId, campaignId)),
          );
      } else {
        if (identity.role !== 'keeper')
          return error('Only the Keeper can move NPCs.', 403);
        await db
          .update(boardPieces)
          .set({ x: Math.round(x), y: Math.round(y) })
          .where(
            and(
              eq(boardPieces.id, targetId),
              eq(boardPieces.campaignId, campaignId),
            ),
          );
      }
    }
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
    });
  }
  if (action === 'toggleCondition') {
    const targetId = clean(body.targetId, 100),
      condition = clean(body.condition, 40);
    if (identity.role === 'player' && identity.playerId !== targetId)
      return error('You can only change your own conditions.', 403);
    const target = await db
      .select()
      .from(players)
      .where(and(eq(players.id, targetId), eq(players.campaignId, campaignId)))
      .get();
    if (!target?.characterJson) return error('Investigator not found.', 404);
    const character = JSON.parse(target.characterJson) as Character,
      current = character.conditions || [],
      active = current.includes(condition);
    character.conditions = active
      ? current.filter((v) => v !== condition)
      : [...current, condition];
    await db
      .update(players)
      .set({ characterJson: JSON.stringify(character) })
      .where(eq(players.id, targetId));
    await log(
      campaignId,
      identity.displayName,
      'condition',
      `${character.name} is ${active ? 'no longer ' : ''}${condition.toLowerCase()}.`,
    );
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
    });
  }
  if (action === 'spendLuck') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only a player can spend their Luck.', 403);
    const amount = Math.max(1, Math.min(99, Number(body.amount) || 0)),
      target = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.id, identity.playerId),
            eq(players.campaignId, campaignId),
          ),
        )
        .get();
    if (!target?.characterJson) return error('Investigator not found.', 404);
    const character = JSON.parse(target.characterJson) as Character;
    if (character.luck < amount) return error('Not enough Luck.');
    character.luck -= amount;
    await db
      .update(players)
      .set({ characterJson: JSON.stringify(character) })
      .where(eq(players.id, identity.playerId));
    await log(
      campaignId,
      identity.displayName,
      'luck',
      `${character.name} spent ${amount} Luck to turn ${clean(body.check, 80)} into a Success (${Number(body.rolled)} → ${Number(body.target)}).`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
    });
  }
  if (action === 'resolveDevelopment') {
    const targetId = clean(body.targetId, 100);
    if (identity.role === 'player' && identity.playerId !== targetId)
      return error('You can only develop your own investigator.', 403);
    const target = await db
      .select()
      .from(players)
      .where(and(eq(players.id, targetId), eq(players.campaignId, campaignId)))
      .get();
    if (!target?.characterJson) return error('Investigator not found.', 404);
    const c = JSON.parse(target.characterJson) as Character,
      changes: string[] = [];
    for (const key of c.improvementMarks || []) {
      let current = 0;
      if (key.startsWith('custom:'))
        current =
          c.customSkills?.find((s) => `custom:${s.id}` === key)?.value || 0;
      else current = c.skills?.[key] || 0;
      const check = Math.ceil(Math.random() * 100);
      if (check > current) {
        const gain = Math.ceil(Math.random() * 10),
          next = Math.min(99, current + gain);
        if (key.startsWith('custom:'))
          c.customSkills = (c.customSkills || []).map((s) =>
            `custom:${s.id}` === key ? { ...s, value: next } : s,
          );
        else c.skills = { ...c.skills, [key]: next };
        changes.push(`${key} +${next - current}`);
      }
    }
    c.improvementMarks = [];
    await db
      .update(players)
      .set({ characterJson: JSON.stringify(c) })
      .where(eq(players.id, targetId));
    await log(
      campaignId,
      identity.displayName,
      'development',
      changes.length
        ? `${c.name}'s development phase: ${changes.join(', ')}.`
        : `${c.name}'s development checks yielded no improvements.`,
    );
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
    });
  }
  if (action === 'rollFormula') {
    const formula = clean(body.formula, 40).toUpperCase().replace(/\s/g, ''),
      check = clean(body.check, 80) || 'Damage roll';
    if (!/^[0-9D+-]+$/.test(formula))
      return error('Use a formula such as 1D6+1D4+2.');
    let total = 0;
    const parts = formula.match(/[+-]?[^+-]+/g) || [];
    for (const part of parts) {
      const sign = part.startsWith('-') ? -1 : 1,
        term = part.replace(/^[+-]/, '');
      if (term.includes('D')) {
        const [countRaw, sidesRaw] = term.split('D'),
          count = Math.max(1, Math.min(20, Number(countRaw) || 1)),
          sides = Math.max(2, Math.min(100, Number(sidesRaw) || 0));
        if (!sides) return error('Invalid dice formula.');
        for (let i = 0; i < count; i++)
          total += sign * Math.ceil(Math.random() * sides);
      } else total += sign * (Number(term) || 0);
    }
    await log(
      campaignId,
      identity.displayName,
      'roll',
      `${check}: ${formula} = ${total}.`,
      { formula, total, check },
    );
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
      total,
    });
  }
  if (action === 'weaponAttack') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players can use investigator weapons.', 403);
    const weaponId = clean(body.weaponId, 80),
      target = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.id, identity.playerId),
            eq(players.campaignId, campaignId),
          ),
        )
        .get();
    if (!target?.characterJson) return error('Investigator not found.', 404);
    const c = JSON.parse(target.characterJson) as Character,
      weapon = c.weapons?.find((w) => w.id === weaponId);
    if (!weapon) return error('Weapon not found.', 404);
    if (weapon.maxAmmo > 0 && weapon.ammo <= 0)
      return error(`${weapon.name} is empty.`);
    if (weapon.maxAmmo > 0) weapon.ammo = Math.max(0, weapon.ammo - 1);
    const skillTarget = Math.max(1, Math.min(99, Number(body.target) || 1)),
      bp = Math.max(-2, Math.min(2, Number(body.bonusPenalty) || 0)),
      result = percentile(skillTarget, bp);
    if (result.outcome.includes('Success'))
      c.improvementMarks = Array.from(
        new Set([...(c.improvementMarks || []), weapon.skillKey]),
      );
    await db
      .update(players)
      .set({ characterJson: JSON.stringify(c) })
      .where(eq(players.id, identity.playerId));
    await log(
      campaignId,
      identity.displayName,
      'roll',
      `${weapon.name} attack: ${result.roll} vs ${skillTarget} — ${result.outcome}. Ammo ${weapon.ammo}/${weapon.maxAmmo}.${result.roll >= weapon.malfunction ? ' Malfunction!' : ''}`,
      { ...result, weaponId, bp },
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
      ...result,
    });
  }
  if (action === 'reloadWeapon') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players can reload investigator weapons.', 403);
    const weaponId = clean(body.weaponId, 80),
      target = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.id, identity.playerId),
            eq(players.campaignId, campaignId),
          ),
        )
        .get();
    if (!target?.characterJson) return error('Investigator not found.', 404);
    const c = JSON.parse(target.characterJson) as Character,
      weapon = c.weapons?.find((w) => w.id === weaponId);
    if (!weapon) return error('Weapon not found.', 404);
    weapon.ammo = weapon.maxAmmo;
    await db
      .update(players)
      .set({ characterJson: JSON.stringify(c) })
      .where(eq(players.id, identity.playerId));
    await log(
      campaignId,
      identity.displayName,
      'weapon',
      `${c.name} reloaded ${weapon.name} (${weapon.ammo}/${weapon.maxAmmo}).`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
    });
  }
  if (action === 'castSpell') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players can cast investigator spells.', 403);
    const spellId = clean(body.spellId, 80),
      target = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.id, identity.playerId),
            eq(players.campaignId, campaignId),
          ),
        )
        .get();
    if (!target?.characterJson) return error('Investigator not found.', 404);
    const c = JSON.parse(target.characterJson) as Character,
      spell = c.spells?.find((s) => s.id === spellId);
    if (!spell) return error('Spell not found.', 404);
    const mp = Math.max(0, Number(/(\d+)\s*MP/i.exec(spell.cost)?.[1]) || 0),
      san = Math.max(0, Number(/(\d+)/.exec(spell.sanityCost)?.[1]) || 0);
    if (c.mp < mp) return error(`Not enough MP to cast ${spell.name}.`);
    c.mp -= mp;
    c.sanity = Math.max(0, c.sanity - san);
    await db
      .update(players)
      .set({ characterJson: JSON.stringify(c) })
      .where(eq(players.id, identity.playerId));
    const message = `${c.name} cast ${spell.name}${mp ? ` (−${mp} MP)` : ''}${san ? ` (−${san} SAN)` : ''}.`;
    await log(campaignId, identity.displayName, 'spell', message, {
      spellId,
      mp,
      san,
    });
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
      message,
    });
  }
  if (action === 'opposedRoll') {
    if (identity.role !== 'player' || !identity.playerId)
      return error('Only players initiate opposed checks here.', 403);
    const opponentId = clean(body.opponentId, 80),
      challenger = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.id, identity.playerId),
            eq(players.campaignId, campaignId),
          ),
        )
        .get(),
      opponent = await db
        .select()
        .from(players)
        .where(
          and(eq(players.id, opponentId), eq(players.campaignId, campaignId)),
        )
        .get();
    if (!challenger?.characterJson || !opponent?.characterJson)
      return error('Choose a valid opponent.');
    const a = JSON.parse(challenger.characterJson) as Character,
      b = JSON.parse(opponent.characterJson) as Character,
      aTarget = Math.max(1, Math.min(99, Number(body.challengerTarget) || 1)),
      bTarget = Math.max(1, Math.min(99, Number(body.opponentTarget) || 1)),
      ar = percentile(aTarget),
      br = percentile(bTarget),
      aRank = successRank(ar.outcome),
      bRank = successRank(br.outcome);
    const winner =
      aRank > bRank
        ? a.name
        : bRank > aRank
          ? b.name
          : aTarget > bTarget
            ? a.name
            : bTarget > aTarget
              ? b.name
              : 'Tie';
    const skillName = clean(body.skillName, 80) || 'Opposed check';
    await log(
      campaignId,
      identity.displayName,
      'opposed',
      `${skillName}: ${a.name} rolled ${ar.roll}/${aTarget} (${ar.outcome}); ${b.name} rolled ${br.roll}/${bTarget} (${br.outcome}). Winner: ${winner}.`,
    );
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId),
      challengerRoll: ar.roll,
      opponentRoll: br.roll,
      winner,
    });
  }
  if (action === 'roll') {
    const sides = Math.max(2, Math.min(100, Number(body.sides) || 100)),
      count = Math.max(1, Math.min(8, Number(body.count) || 1)),
      check = clean(body.check, 80) || `${count}d${sides} roll`,
      target = Math.max(0, Math.min(100, Number(body.target) || 0));
    const bp = Math.max(-2, Math.min(2, Number(body.bonusPenalty) || 0)),
      percentileResult =
        sides === 100 && count === 1 && target ? percentile(target, bp) : null;
    const rolls = percentileResult
      ? [percentileResult.roll]
      : Array.from({ length: count }, () => Math.ceil(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0),
      rolled = rolls[0];
    let outcome = '';
    if (percentileResult) outcome = percentileResult.outcome;
    else if (sides === 100 && count === 1 && target) {
      outcome =
        rolled === 1
          ? 'Critical Success'
          : (rolled >= 96 && target < 50) || rolled === 100
            ? 'Fumble'
            : rolled <= Math.floor(target / 5)
              ? 'Extreme Success'
              : rolled <= Math.floor(target / 2)
                ? 'Hard Success'
                : rolled <= target
                  ? 'Success'
                  : 'Failure';
    }
    const skillKey = clean(body.skillKey, 80),
      pushed = Boolean(body.pushed);
    if (
      identity.role === 'player' &&
      identity.playerId &&
      skillKey &&
      outcome.includes('Success') &&
      !pushed
    ) {
      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, identity.playerId))
        .get();
      if (player?.characterJson) {
        const c = JSON.parse(player.characterJson) as Character;
        c.improvementMarks = Array.from(
          new Set([...(c.improvementMarks || []), skillKey]),
        );
        await db
          .update(players)
          .set({ characterJson: JSON.stringify(c) })
          .where(eq(players.id, identity.playerId));
      }
    }
    const result = `${rolls.join(', ')}${count > 1 ? ` = ${total}` : ''}`;
    await log(
      campaignId,
      identity.displayName,
      'roll',
      `${check}: ${result}${target ? ` vs ${target}` : ''}${outcome ? ` — ${outcome}` : ''}${bp ? ` (${Math.abs(bp)} ${bp < 0 ? 'bonus' : 'penalty'} ${Math.abs(bp) === 1 ? 'die' : 'dice'})` : ''}.${pushed && outcome === 'Failure' ? ' The pushed roll failed; the Keeper applies the announced consequence.' : ''}`,
      {
        sides,
        count,
        rolls,
        total,
        check,
        target: target || undefined,
        outcome: outcome || undefined,
      },
    );
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
      rolls,
      total,
      outcome,
    });
  }
  if (action === 'unreality') {
    if (identity.role !== 'keeper')
      return error('Keeper access required.', 403);
    const roll = Math.ceil(Math.random() * 12),
      result = unreality[roll - 1];
    await log(campaignId, 'UNREALITY', 'unreality', `${roll}. ${result}`, {
      roll,
    });
    return NextResponse.json({
      campaign: await snapshot(campaignId, identity.playerId, true),
      roll,
      result,
    });
  }
  if (action === 'message') {
    const message = clean(body.message, 300);
    if (!message) return error('Message is empty.');
    await log(campaignId, identity.displayName, 'message', message);
    return NextResponse.json({
      campaign: await snapshot(
        campaignId,
        identity.playerId,
        identity.role === 'keeper',
      ),
    });
  }
  return error('Unknown action.');
}
