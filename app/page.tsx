'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  BookOpen,
  Box,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  Coins,
  Copy,
  Crosshair,
  Dices,
  DoorOpen,
  Eye,
  FilePenLine,
  Gem,
  Hand,
  Heading2,
  ImagePlus,
  Italic,
  KeyRound,
  List,
  Map,
  Maximize2,
  MessageSquareMore,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Ruler,
  Save,
  ScrollText,
  Search,
  ShieldAlert,
  Skull,
  Sparkles,
  Square,
  Swords,
  Trash2,
  UserRoundPlus,
  Users,
  Waypoints,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  BoardMark,
  Campaign,
  Character,
  CharacterWeapon,
  Encounter,
  Membership,
  Piece,
  PieceDetails,
  Scene,
  Session,
} from '@/lib/game-types';

const SESSION_KEY = 'the-veil-session-v2';
type KeeperSection =
  | 'overview'
  | 'players'
  | 'story'
  | 'cast'
  | 'loot'
  | 'encounters'
  | 'imports';
type PlayerSection = 'sheet' | 'edit' | 'notes' | 'gear';
function currentRoute() {
  if (typeof window === 'undefined')
    return { campaignId: '', screen: 'home', section: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    campaignId: params.get('campaign') || '',
    screen: params.get('screen') || 'home',
    section: params.get('section') || '',
  };
}
function setRoute(
  campaignId?: string | null,
  screen?: string,
  section?: string,
  replace = true,
) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (campaignId) params.set('campaign', campaignId);
  if (screen && screen !== 'home') params.set('screen', screen);
  if (section) params.set('section', section);
  const url = `/${params.size ? `?${params.toString()}` : ''}`;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}
const mapTools = [
  MousePointer2,
  Hand,
  Pencil,
  Ruler,
  Square,
  CircleDashed,
  Crosshair,
  Eye,
];
const skillCatalog = [
  ['accounting', 'Accounting', 5],
  ['anthropology', 'Anthropology', 1],
  ['appraise', 'Appraise', 5],
  ['archaeology', 'Archaeology', 1],
  ['artCraft', 'Art / Craft', 5],
  ['charm', 'Charm', 15],
  ['climb', 'Climb', 20],
  ['creditRating', 'Credit Rating', 0],
  ['cthulhuMythos', 'Cthulhu Mythos', 0],
  ['disguise', 'Disguise', 5],
  ['dodge', 'Dodge', 0],
  ['driveAuto', 'Drive Auto', 20],
  ['electricalRepair', 'Electrical Repair', 10],
  ['fastTalk', 'Fast Talk', 5],
  ['fightingBrawl', 'Fighting (Brawl)', 25],
  ['firearmsHandgun', 'Firearms (Handgun)', 20],
  ['firearmsRifleShotgun', 'Firearms (Rifle/Shotgun)', 25],
  ['firstAid', 'First Aid', 30],
  ['history', 'History', 5],
  ['intimidate', 'Intimidate', 15],
  ['jump', 'Jump', 20],
  ['languageOwn', 'Language (Own)', 0],
  ['law', 'Law', 5],
  ['libraryUse', 'Library Use', 20],
  ['listen', 'Listen', 20],
  ['locksmith', 'Locksmith', 1],
  ['mechanicalRepair', 'Mechanical Repair', 10],
  ['medicine', 'Medicine', 1],
  ['naturalWorld', 'Natural World', 10],
  ['navigate', 'Navigate', 10],
  ['occult', 'Occult', 5],
  ['operateHeavyMachinery', 'Operate Heavy Machinery', 1],
  ['persuade', 'Persuade', 10],
  ['psychoanalysis', 'Psychoanalysis', 1],
  ['psychology', 'Psychology', 10],
  ['ride', 'Ride', 5],
  ['science', 'Science', 1],
  ['sleightOfHand', 'Sleight of Hand', 10],
  ['spotHidden', 'Spot Hidden', 25],
  ['stealth', 'Stealth', 20],
  ['survival', 'Survival', 10],
  ['swim', 'Swim', 20],
  ['throw', 'Throw', 20],
  ['track', 'Track', 10],
] as const;
function resolvedSkills(c: Character) {
  const values: Record<string, number> = {};
  for (const [key, , base] of skillCatalog)
    values[key] =
      key === 'dodge'
        ? Math.floor(c.dex / 2)
        : key === 'languageOwn'
          ? c.edu
          : key === 'creditRating'
            ? c.credit
            : base;
  return { ...values, ...c.skills };
}
const conditionCatalog = [
  'Major wound',
  'Unconscious',
  'Dying',
  'Temporary insanity',
  'Indefinite insanity',
  'Prone',
];
const occupationTemplates = [
  {
    name: 'Antiquarian',
    formula: 'edu4',
    skills: [
      'appraise',
      'artCraft',
      'history',
      'libraryUse',
      'languageOwn',
      'spotHidden',
    ],
  },
  {
    name: 'Doctor of Medicine',
    formula: 'edu4',
    skills: ['firstAid', 'languageOwn', 'medicine', 'psychology', 'science'],
  },
  {
    name: 'Investigative Journalist',
    formula: 'edu4',
    skills: [
      'artCraft',
      'history',
      'libraryUse',
      'languageOwn',
      'persuade',
      'psychology',
      'spotHidden',
    ],
  },
  {
    name: 'Police Detective',
    formula: 'edu2dex2',
    skills: [
      'artCraft',
      'disguise',
      'fightingBrawl',
      'firearmsHandgun',
      'law',
      'listen',
      'psychology',
      'spotHidden',
    ],
  },
  {
    name: 'Private Investigator',
    formula: 'edu2dex2',
    skills: [
      'artCraft',
      'disguise',
      'law',
      'libraryUse',
      'psychology',
      'spotHidden',
      'stealth',
    ],
  },
  {
    name: 'Professor',
    formula: 'edu4',
    skills: ['libraryUse', 'languageOwn', 'psychology', 'science'],
  },
] as const;
const emptyBackstory = {
  appearance: '',
  ideology: '',
  significantPeople: '',
  meaningfulLocations: '',
  treasuredPossessions: '',
  traits: '',
};
const blankCharacter: Character = {
  name: '',
  occupation: '',
  age: 28,
  residence: 'Los Angeles',
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 60,
  pow: 50,
  edu: 60,
  luck: 50,
  hp: 10,
  maxHp: 10,
  sanity: 50,
  mp: 10,
  credit: 20,
  mov: 8,
  build: 0,
  damageBonus: 'None',
  anchor: '',
  connection: '',
  secret: '',
  skills: {},
  customSkills: [],
  weapons: [],
  conditions: [],
  sanityEpisodes: [],
  improvementMarks: [],
  occupationFormula: 'edu4',
  occupationSkillKeys: [],
  possessions: '',
  backstory: emptyBackstory,
  modifiers: [],
  spells: [],
  tomes: [],
  chase: {
    speed: 8,
    actionPoints: 1,
    location: '',
    vehicle: '',
    vehicleBuild: 0,
    notes: '',
  },
};
const tokenArt: Record<string, string> = {
  'Evelyn Shaw': '/tokens/evelyn-shaw.png',
  'Jack Moretti': '/tokens/jack-moretti.png',
  'Dr. Miriam Bell': '/tokens/miriam-bell.png',
  'Tomás Navarro': '/tokens/tomas-navarro.png',
  'Beatrice Vale': '/tokens/beatrice-vale.png',
  'Quiet Choir Enforcer': '/tokens/quiet-choir-enforcer.png',
  'Drowned Revenant': '/tokens/drowned-revenant.png',
  'Faceless Conductor': '/tokens/faceless-conductor.png',
  'Oil-field Crawler': '/tokens/oil-field-crawler.png',
  'Fog-born Hound': '/tokens/fog-born-hound.png',
};

function rollDice(count: number) {
  return Array.from({ length: count }, () =>
    Math.ceil(Math.random() * 6),
  ).reduce((a, b) => a + b, 0);
}
function derivedStats(character: Character) {
  const sum = character.str + character.siz;
  let build = -2,
    damageBonus = '−2';
  if (sum >= 65) {
    build = -1;
    damageBonus = '−1';
  }
  if (sum >= 85) {
    build = 0;
    damageBonus = 'None';
  }
  if (sum >= 125) {
    build = 1;
    damageBonus = '+1D4';
  }
  if (sum >= 165) {
    build = 2;
    damageBonus = '+1D6';
  }
  if (sum >= 205) {
    const extra = Math.floor((sum - 205) / 80);
    build = 3 + extra;
    damageBonus = `+${2 + extra}D6`;
  }
  let mov =
    character.str < character.siz && character.dex < character.siz
      ? 7
      : character.str > character.siz && character.dex > character.siz
        ? 9
        : 8;
  mov -=
    character.age >= 80
      ? 5
      : character.age >= 70
        ? 4
        : character.age >= 60
          ? 3
          : character.age >= 50
            ? 2
            : character.age >= 40
              ? 1
              : 0;
  return {
    maxHp: Math.floor((character.con + character.siz) / 10),
    mov: Math.max(1, mov),
    build,
    damageBonus,
  };
}
function finances(credit: number) {
  if (credit <= 0)
    return { cash: '$0.50', assets: 'None', spendingLevel: '$0.50' };
  if (credit < 10)
    return {
      cash: `$${credit * 2}`,
      assets: `$${credit * 20}`,
      spendingLevel: '$2',
    };
  if (credit < 50)
    return {
      cash: `$${credit * 2}`,
      assets: `$${credit * 50}`,
      spendingLevel: '$10',
    };
  if (credit < 90)
    return {
      cash: `$${credit * 10}`,
      assets: `$${credit * 500}`,
      spendingLevel: '$50',
    };
  if (credit < 99)
    return {
      cash: `$${credit * 50}`,
      assets: `$${credit * 5000}`,
      spendingLevel: '$250',
    };
  return { cash: '$5,000', assets: '$5,000,000+', spendingLevel: '$5,000' };
}
function derived(character: Character) {
  const d = derivedStats(character);
  return {
    ...character,
    ...d,
    hp: d.maxHp,
    sanity: character.pow,
    mp: Math.floor(character.pow / 5),
    ...finances(character.credit),
  };
}
function occupationPoints(c: Character) {
  switch (c.occupationFormula) {
    case 'edu2app2':
      return (c.edu + c.app) * 2;
    case 'edu2dex2':
      return (c.edu + c.dex) * 2;
    case 'edu2str2':
      return (c.edu + c.str) * 2;
    case 'edu2pow2':
      return (c.edu + c.pow) * 2;
    default:
      return c.edu * 4;
  }
}
function allSkills(c: Character) {
  return [
    ...skillCatalog.map(([key, label]) => ({
      key,
      label,
      value: resolvedSkills(c)[key],
    })),
    ...(c.customSkills || []).map((s) => ({
      key: `custom:${s.id}`,
      label: s.name,
      value: s.value,
    })),
  ];
}
function ageGuidance(age: number) {
  if (age < 20)
    return 'Age 15–19: reduce EDU by 5; reduce either STR or SIZ by 5; roll Luck twice and keep the higher result.';
  if (age < 40) return 'Twenties and thirties: make one EDU improvement check.';
  if (age < 50)
    return 'Forties: reduce 5 points across STR, CON, or DEX; reduce APP by 5; make two EDU improvement checks; reduce MOV by 1.';
  if (age < 60)
    return 'Fifties: reduce 10 points across STR, CON, or DEX; reduce APP by 10; make three EDU improvement checks; reduce MOV by 2.';
  if (age < 70)
    return 'Sixties: reduce 20 points across STR, CON, or DEX; reduce APP by 15; make four EDU improvement checks; reduce MOV by 3.';
  if (age < 80)
    return 'Seventies: reduce 40 points across STR, CON, or DEX; reduce APP by 20; make four EDU improvement checks; reduce MOV by 4.';
  return 'Eighties: reduce 80 points across STR, CON, or DEX; reduce APP by 25; make four EDU improvement checks; reduce MOV by 5.';
}

async function api(body: Record<string, unknown>): Promise<any> {
  const response = await fetch('/api/game', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'The server returned an unexpected response.' };
    }
  }
  if (!response.ok)
    throw new Error(
      data.error ||
        `The server could not complete the request (${response.status}).`,
    );
  if (
    typeof window !== 'undefined' &&
    ![
      'login',
      'register',
      'verifyEmail',
      'forgotPassword',
      'resetPassword',
      'logout',
    ].includes(String(body.action))
  )
    window.dispatchEvent(new Event('vtt-state-changed'));
  return data;
}

function buttonTooltip(button: HTMLButtonElement) {
  if (button.title) return;
  let label =
    button.getAttribute('aria-label') ||
    button.getAttribute('data-tooltip') ||
    '';
  if (!label) {
    const preferred = button
        .querySelector('b,strong,[data-label]')
        ?.textContent?.trim(),
      text = button.textContent?.replace(/\s+/g, ' ').trim() || '';
    label = preferred || text;
  }
  if (!label) {
    const icon = [...(button.querySelector('svg')?.classList || [])].find(
      (name) => name.startsWith('lucide-') && name !== 'lucide-icon',
    );
    if (icon) label = icon.replace('lucide-', '').replace(/-/g, ' ');
  }
  if (!label) return;
  label =
    (
      {
        '×': 'Close',
        '+': 'Increase',
        '−': 'Decrease',
        '–': 'Decrease',
      } as Record<string, string>
    )[label] || label;
  label = label.slice(0, 80);
  button.title = label;
  button.setAttribute('aria-label', button.getAttribute('aria-label') || label);
}
function useButtonTooltips() {
  useEffect(() => {
    const scan = (root: Document | HTMLElement = document) =>
      root.querySelectorAll<HTMLButtonElement>('button').forEach(buttonTooltip);
    scan();
    const observer = new MutationObserver((records) =>
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLButtonElement) buttonTooltip(node);
          else if (node instanceof HTMLElement) scan(node);
        }),
      ),
    );
    observer.observe(document.body, { childList: true, subtree: true });
    const hover = (event: Event) => {
      const target = event.target as HTMLElement | null,
        button = target?.closest?.('button');
      if (button instanceof HTMLButtonElement) buttonTooltip(button);
    };
    document.addEventListener('pointerover', hover, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerover', hover, true);
    };
  }, []);
}

export default function Home() {
  useButtonTooltips();
  const initialRoute = useRef(currentRoute());
  const [session, setSession] = useState<Session | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [view, setView] = useState<'home' | 'board'>(
    initialRoute.current.screen === 'board' ? 'board' : 'home',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const refresh = useCallback(
    async (token?: string, campaignId?: string | null) => {
      const version = ++requestVersion.current;
      const value = token || session?.token || '';
      const selected =
        campaignId === undefined ? session?.campaignId : campaignId;
      const response = await fetch(
        `/api/game?${value ? `token=${encodeURIComponent(value)}&` : ''}${selected ? `campaignId=${encodeURIComponent(selected)}` : ''}`,
      );
      if (version !== requestVersion.current) return;
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(SESSION_KEY);
          setSession(null);
          setCampaign(null);
        }
        return;
      }
      const data: any = await response.json();
      if (version !== requestVersion.current) return;
      setSession(data.session);
      setCampaign(data.campaign);
      setMemberships(data.memberships || []);
    },
    [session?.token, session?.campaignId],
  );
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    let savedToken: string | undefined;
    try {
      if (saved) {
        const parsed = JSON.parse(saved) as Session;
        savedToken = parsed.token;
        setSession(parsed);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    void refresh(
      savedToken,
      initialRoute.current.campaignId || undefined,
    ).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!session?.campaignId) return;
    const timer = window.setInterval(
      () => void refresh(session.token, session.campaignId),
      10000,
    );
    return () => window.clearInterval(timer);
  }, [session?.token, session?.campaignId, refresh]);
  useEffect(() => {
    if (!session?.campaignId) return;
    let stopped = false,
      retry = 0;
    let socket: WebSocket | undefined;
    const connect = () => {
      if (stopped) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(
        `${protocol}//${location.host}/api/live?campaign=${encodeURIComponent(session.campaignId!)}`,
      );
      socket.onmessage = () => void refresh(session.token, session.campaignId);
      socket.onclose = () => {
        if (!stopped) retry = window.setTimeout(connect, 1500);
      };
    };
    const announce = () => {
      if (socket?.readyState === WebSocket.OPEN) socket.send('changed');
    };
    connect();
    window.addEventListener('vtt-state-changed', announce);
    return () => {
      stopped = true;
      clearTimeout(retry);
      window.removeEventListener('vtt-state-changed', announce);
      socket?.close();
    };
  }, [session?.token, session?.campaignId, refresh]);
  function accept(data: {
    session?: Session;
    campaign?: Campaign | null;
    memberships?: Membership[];
  }) {
    if (data.session) {
      setSession(data.session);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...data.session,
          role: null,
          campaignId: null,
          playerId: undefined,
        }),
      );
    }
    setCampaign(data.campaign || null);
    if (data.memberships) setMemberships(data.memberships);
    setView('home');
    if (data.campaign && data.session?.role)
      setRoute(
        data.campaign.id,
        data.session.role,
        data.session.role === 'keeper' ? 'overview' : 'sheet',
        false,
      );
    setError('');
  }
  async function leave() {
    if (session)
      void api({ action: 'logout', token: session.token }).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCampaign(null);
    setMemberships([]);
    setRoute(null);
    setError('');
  }
  async function openCampaign(id: string) {
    const version = ++requestVersion.current;
    setError('');
    try {
      const response = await fetch(
          `/api/game?campaignId=${encodeURIComponent(id)}`,
        ),
        text = await response.text();
      let data: any = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        data = { error: 'The server returned an unexpected response.' };
      }
      if (version !== requestVersion.current) return;
      if (!response.ok) {
        setError(data.error || `Unable to open campaign (${response.status}).`);
        return;
      }
      accept(data);
    } catch {
      if (version === requestVersion.current)
        setError('Unable to reach the campaign server.');
    }
  }
  function backToCases() {
    setSession((s) =>
      s ? { ...s, role: null, campaignId: null, playerId: undefined } : s,
    );
    setCampaign(null);
    setView('home');
    setRoute(null);
    void refresh(session?.token, null);
  }
  if (loading)
    return (
      <div className="boot-screen">
        <Eye />
        <span>Finding the table…</span>
      </div>
    );
  if (!session)
    return <Entry onAccept={accept} error={error} setError={setError} />;
  if (!campaign || !session.role)
    return (
      <AccountHub
        session={session}
        memberships={memberships}
        onAccept={accept}
        onOpen={openCampaign}
        onLeave={leave}
        error={error}
        setError={setError}
      />
    );
  const player = campaign.players.find((p) => p.id === session.playerId);
  if (
    session.role === 'player' &&
    (!player?.character || player.characterStatus !== 'final')
  )
    return (
      <CharacterBuilder
        session={session}
        campaign={campaign}
        onAccept={accept}
        onLeave={backToCases}
      />
    );
  if (view === 'board')
    return (
      <Table
        session={session}
        campaign={campaign}
        onCampaign={setCampaign}
        onLeave={() => {
          setView('home');
          setRoute(campaign.id, session.role || 'home', currentRoute().section);
        }}
      />
    );
  const openBoard = () => {
    setView('board');
    setRoute(campaign.id, 'board', currentRoute().section);
  };
  return session.role === 'keeper' ? (
    <KeeperHome
      session={session}
      campaign={campaign}
      initialSection={initialRoute.current.section}
      onSection={(section) => setRoute(campaign.id, 'keeper', section)}
      onCampaign={setCampaign}
      onBoard={openBoard}
      onBack={backToCases}
    />
  ) : (
    <PlayerHome
      session={session}
      campaign={campaign}
      initialSection={initialRoute.current.section}
      onSection={(section) => setRoute(campaign.id, 'player', section)}
      onCampaign={setCampaign}
      onBoard={openBoard}
      onBack={backToCases}
    />
  );
}

function Entry({
  onAccept,
  error,
  setError,
}: {
  onAccept: (data: { session: Session; memberships: Membership[] }) => void;
  error: string;
  setError: (s: string) => void;
}) {
  const [mode, setMode] = useState<
    'login' | 'register' | 'verify' | 'forgot' | 'reset'
  >('login');
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    code: '',
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const action =
        mode === 'forgot'
          ? 'forgotPassword'
          : mode === 'reset'
            ? 'resetPassword'
            : mode === 'verify'
              ? 'verifyEmail'
              : mode;
      const data = await api({ action, ...form });
      if (data.requiresVerification) {
        setMode('verify');
        setDevCode(data.developmentCode || '');
        setMessage('Enter the six-digit code sent to your email.');
      } else if (mode === 'forgot') {
        setMode('reset');
        setDevCode(data.developmentCode || '');
        setMessage(data.message);
      } else onAccept(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }
  const authMode = mode === 'login' || mode === 'register';
  return (
    <main className="entry-shell">
      <div className="entry-glow" />
      <section className="entry-card">
        <div className="entry-brand">
          <Eye />
          <span>THE VEIL</span>
          <small>LOS ANGELES · 1926</small>
        </div>
        <p className="kicker">A CALL OF CTHULHU VIRTUAL TABLETOP</p>
        <h1>
          {authMode ? (
            <>
              Your case files
              <br />
              remember you.
            </>
          ) : mode === 'verify' ? (
            'Verify your identity'
          ) : mode === 'forgot' ? (
            'Recover your account'
          ) : (
            'Choose a new password'
          )}
        </h1>
        <p className="entry-copy">
          {authMode
            ? 'Sign in to return to your campaigns, investigators, and shared tables from any browser.'
            : mode === 'verify'
              ? 'We need to confirm the address attached to your case files.'
              : 'Use a short-lived code to regain access to your investigations.'}
        </p>
        {authMode && (
          <div className="entry-tabs">
            <button
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Sign in
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Create account
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Name at the table
              <input
                autoFocus
                required
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                placeholder="Miguel"
              />
            </label>
          )}
          <label>
            Email
            <input
              autoFocus
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </label>
          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <label>
              {mode === 'reset' ? 'New password' : 'Password'}
              <input
                required
                minLength={8}
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </label>
          )}
          {(mode === 'verify' || mode === 'reset') && (
            <label>
              Six-digit code
              <input
                required
                className="code-input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.replace(/\D/g, '') })
                }
                placeholder="000000"
              />
            </label>
          )}
          {devCode && (
            <div className="development-code">
              <small>LOCAL DEVELOPMENT CODE</small>
              <b>{devCode}</b>
            </div>
          )}
          {message && <p className="form-success">{message}</p>}
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Checking the records…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset code'
                    : mode === 'verify'
                      ? 'Verify email'
                      : 'Reset password'}{' '}
            <KeyRound />
          </Button>
          {mode === 'login' && (
            <p className="beta-note">
              Password recovery will be added after the private beta.
            </p>
          )}
          {!authMode && (
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setMode('login');
                setDevCode('');
                setError('');
              }}
            >
              Back to sign in
            </button>
          )}
          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
      <footer>
        PRIVATE BETA · SECURE HTTPONLY SESSION · RATE-LIMITED ACCESS
      </footer>
    </main>
  );
}

function AccountHub({
  session,
  memberships,
  onAccept,
  onOpen,
  onLeave,
  error,
  setError,
}: {
  session: Session;
  memberships: Membership[];
  onAccept: (d: {
    session: Session;
    campaign?: Campaign | null;
    memberships?: Membership[];
  }) => void;
  onOpen: (id: string) => void;
  onLeave: () => void;
  error: string;
  setError: (s: string) => void;
}) {
  const [mode, setMode] = useState<'cases' | 'create' | 'join'>('cases');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    campaign: '',
    year: '1926',
    location: 'Los Angeles County',
    code: '',
    name: session.displayName,
  });
  async function submit(
    action: 'createCampaign' | 'joinCampaign' | 'createSampleCampaign',
  ) {
    setBusy(true);
    setError('');
    try {
      onAccept(
        await api({
          action,
          token: session.token,
          name: form.campaign || form.name,
          year: form.year,
          location: form.location,
          joinCode: form.code,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="hub-shell">
      <header className="hub-header">
        <div className="entry-brand">
          <Eye />
          <span>THE VEIL</span>
        </div>
        <div className="account-chip">
          <span>{session.displayName}</span>
          <small>{session.email}</small>
          <button onClick={onLeave}>Sign out</button>
        </div>
      </header>
      <section className="hub-content">
        <div className="hub-heading">
          <div>
            <span className="eyebrow">YOUR CASE FILES</span>
            <h1>Welcome back, {session.displayName}.</h1>
            <p>
              Your account can Keep campaigns, play investigators, or do both.
            </p>
          </div>
          {memberships.length > 0 && (
            <div className="hub-actions">
              <Button variant="outline" onClick={() => setMode('join')}>
                <DoorOpen /> Join as player
              </Button>
              <Button onClick={() => setMode('create')}>
                <Plus /> New Keeper campaign
              </Button>
            </div>
          )}
        </div>
        {mode === 'cases' && (
          <div className="case-grid">
            {memberships.map((m) => (
              <button
                className="case-card"
                key={`${m.role}-${m.campaignId}`}
                onClick={() => onOpen(m.campaignId)}
              >
                <span className={`case-role ${m.role}`}>
                  {m.role === 'keeper' ? <ShieldAlert /> : <Users />}
                  {m.role}
                </span>
                <h2>{m.name}</h2>
                <p>
                  {m.location} · {m.year}
                </p>
                <footer>
                  <span>{m.status === 'live' ? 'Session live' : m.status}</span>
                  <b>
                    {m.role === 'player'
                      ? m.characterName || 'Create investigator'
                      : `${m.sessionNumber} sessions`}
                  </b>
                </footer>
              </button>
            ))}
            {memberships.length === 0 && (
              <div className="role-choice">
                <button onClick={() => setMode('create')}>
                  <ShieldAlert />
                  <span>
                    <small>RUN A GAME</small>
                    <b>I’m a Keeper</b>
                    <em>Create a campaign and invite your investigators.</em>
                  </span>
                </button>
                <button onClick={() => setMode('join')}>
                  <Users />
                  <span>
                    <small>JOIN A GAME</small>
                    <b>I’m a Player</b>
                    <em>Enter the six-character code from your Keeper.</em>
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
        {mode === 'create' && (
          <section className="hub-form">
            <button className="back-link" onClick={() => setMode('cases')}>
              ← Back to cases
            </button>
            <span className="case-role keeper">
              <ShieldAlert /> Keeper setup
            </span>
            <h2>Open a campaign</h2>
            <label>
              Campaign name
              <input
                autoFocus
                value={form.campaign}
                onChange={(e) => setForm({ ...form, campaign: e.target.value })}
                placeholder="The City That Dreams Below"
              />
            </label>
            <div className="form-pair">
              <label>
                Year
                <input
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                />
              </label>
              <label>
                Setting
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </label>
            </div>
            <Button
              disabled={busy || form.campaign.length < 3}
              onClick={() => submit('createCampaign')}
            >
              Create Keeper campaign
            </Button>
            <button
              className="sample-campaign-button"
              disabled={busy}
              onClick={() => submit('createSampleCampaign')}
            >
              <Sparkles /> Generate the sample campaign
            </button>
            {error && <p className="form-error">{error}</p>}
          </section>
        )}
        {mode === 'join' && (
          <section className="hub-form">
            <button className="back-link" onClick={() => setMode('cases')}>
              ← Back to cases
            </button>
            <span className="case-role player">
              <Users /> Player setup
            </span>
            <h2>Join your Keeper’s campaign</h2>
            <p className="form-help">
              Ask your Keeper for the six-character campaign code shown on their
              dashboard.
            </p>
            <label>
              Campaign code
              <input
                autoFocus
                className="code-input"
                maxLength={6}
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="XXXXXX"
              />
            </label>
            <label>
              Name at this table
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <Button
              disabled={busy || form.code.length !== 6}
              onClick={() => submit('joinCampaign')}
            >
              <DoorOpen /> Join as player
            </Button>
            {error && <p className="form-error">{error}</p>}
          </section>
        )}
      </section>
    </main>
  );
}

const quickNames = {
  npc: [
    'Mabel Quinn',
    'Elias Ward',
    'Roscoe Bell',
    'Vera Holloway',
    'Arthur Pike',
    'Nora Finch',
  ],
  mob: [
    'Ashen Longshoreman',
    'Choir Knife',
    'Tunnel Stalker',
    'Dream-Sick Hound',
    'Faceless Deputy',
    'Saltwater Dead',
  ],
};
const quickOccupations = [
  'Reporter',
  'Police detective',
  'Night clerk',
  'Studio fixer',
  'Physician',
  'Dock foreman',
];
function quickDetails(kind: 'npc' | 'mob'): PieceDetails {
  const n = () => 25 + Math.floor(Math.random() * 10) * 5;
  return kind === 'npc'
    ? {
        occupation:
          quickOccupations[Math.floor(Math.random() * quickOccupations.length)],
        description:
          'A wary Los Angeles local with a practiced story and tired eyes.',
        motivation: 'Keep a dangerous arrangement from becoming public.',
        hook: 'Needs discreet help before agreeing to share what they know.',
        secret: 'Recognizes a symbol connected to the case.',
        str: n(),
        con: n(),
        siz: n(),
        dex: n(),
        app: n(),
        int: n(),
        pow: n(),
        fighting: 25,
      }
    : {
        description:
          'A hostile presence shaped by the city’s buried unreality.',
        motivation: 'Silence witnesses and recover the missing evidence.',
        hook: 'Its arrival reveals that someone has been followed.',
        str: n() + 20,
        con: n() + 20,
        siz: n() + 20,
        dex: n(),
        int: 25,
        pow: n() + 10,
        fighting: 45,
        damage: '1D6 + damage bonus',
        armor: '1 point',
        sanityLoss: '0/1D4',
        attacks: 'One attack per round; fights back when pressed.',
      };
}

function KeeperHome({
  session,
  campaign,
  initialSection,
  onSection,
  onCampaign,
  onBoard,
  onBack,
}: {
  session: Session;
  campaign: Campaign;
  initialSection: string;
  onSection: (section: KeeperSection) => void;
  onCampaign: (c: Campaign) => void;
  onBoard: () => void;
  onBack: () => void;
}) {
  const keeperSections: KeeperSection[] = [
    'overview',
    'players',
    'story',
    'cast',
    'loot',
    'encounters',
    'imports',
  ];
  const [section, setSection] = useState<KeeperSection>(
    keeperSections.includes(initialSection as KeeperSection)
      ? (initialSection as KeeperSection)
      : 'overview',
  );
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [editor, setEditor] = useState<'scene' | 'npc' | 'mob' | null>(null);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [prompt, setPrompt] = useState('');
  const [tokenName, setTokenName] = useState('Codex creative workflow');
  const [newToken, setNewToken] = useState('');
  const [sceneDraft, setSceneDraft] = useState({
    chapter: 'Chapter 1',
    title: '',
    description: '',
    objective: '',
    clues: '',
    keeperNotes: '',
    status: 'planned',
  });
  const [pieceDraft, setPieceDraft] = useState({
    name: '',
    hp: 10,
    hidden: false,
    details: {} as PieceDetails,
  });
  useEffect(() => onSection(section), [section]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setNotice('');
    try {
      const data = await api({
        action,
        token: session.token,
        campaignId: campaign.id,
        ...extra,
      });
      if (data.campaign) onCampaign(data.campaign);
      return data;
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : 'The case file could not be updated.',
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  function openScene(scene?: Scene) {
    setEditingId(scene?.id || '');
    setSceneDraft(
      scene
        ? {
            chapter: scene.chapter,
            title: scene.title,
            description: scene.description,
            objective: scene.objective,
            clues: scene.clues,
            keeperNotes: scene.keeperNotes,
            status: scene.status,
          }
        : {
            chapter: `Chapter ${Math.max(1, new Set(campaign.scenes.map((s) => s.chapter)).size || 1)}`,
            title: '',
            description: '',
            objective: '',
            clues: '',
            keeperNotes: '',
            status: 'planned',
          },
    );
    setEditor('scene');
  }
  function openPiece(kind: 'npc' | 'mob', piece?: Piece) {
    setEditingId(piece?.id || '');
    setPieceDraft(
      piece
        ? {
            name: piece.name,
            hp: piece.maxHp || 10,
            hidden: piece.hidden,
            details: piece.details,
          }
        : {
            name: '',
            hp: kind === 'mob' ? 12 : 10,
            hidden: false,
            details: quickDetails(kind),
          },
    );
    setEditor(kind);
  }
  async function quickPiece(kind: 'npc' | 'mob') {
    const names = quickNames[kind],
      name = names[Math.floor(Math.random() * names.length)],
      details = quickDetails(kind);
    await act('savePiece', {
      name,
      kind,
      hp: kind === 'mob' ? 12 : 10,
      hidden: false,
      details,
    });
    setNotice(`${name} added to the cast and board.`);
  }
  async function saveEditor() {
    if (editor === 'scene') {
      const data = await act('saveScene', {
        sceneId: editingId,
        ...sceneDraft,
      });
      if (data) setEditor(null);
    } else if (editor) {
      const data = await act('savePiece', {
        pieceId: editingId,
        name: pieceDraft.name,
        kind: editor,
        hp: pieceDraft.hp,
        hidden: pieceDraft.hidden,
        details: pieceDraft.details,
      });
      if (data) setEditor(null);
    }
  }
  const player = campaign.players.find((p) => p.id === selectedPlayer);
  function castCard(piece: Piece) {
    return (
      <article key={piece.id} className={piece.kind}>
        <header>
          <span className={`mini-token ${piece.kind}`}>{piece.initials}</span>
          <div>
            <b>{piece.name}</b>
            <small>
              {piece.kind === 'mob'
                ? 'MOB / threat'
                : piece.details.occupation || 'NPC'}{' '}
              · {piece.hidden ? 'Hidden' : 'Visible'}
            </small>
          </div>
          <div className="cast-card-tools">
            <button
              title={`Edit ${piece.name}`}
              aria-label={`Edit ${piece.name}`}
              onClick={() =>
                openPiece(piece.kind === 'mob' ? 'mob' : 'npc', piece)
              }
            >
              <FilePenLine />
            </button>
            <button
              className="delete-action"
              title={`Delete ${piece.name}`}
              aria-label={`Delete ${piece.name}`}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete ${piece.name}? This removes it from the cast and board.`,
                  )
                )
                  void act('deletePiece', { pieceId: piece.id });
              }}
              disabled={busy}
            >
              <Trash2 />
            </button>
          </div>
        </header>
        <p>{piece.details.description || 'No description recorded.'}</p>
        <div className="cast-statline">
          <span>
            HP <b>{piece.maxHp || '—'}</b>
          </span>
          <span>
            DEX <b>{piece.details.dex || '—'}</b>
          </span>
          <span>
            Fight{' '}
            <b>{piece.details.fighting ? `${piece.details.fighting}%` : '—'}</b>
          </span>
          {piece.kind === 'mob' && (
            <span>
              SAN <b>{piece.details.sanityLoss || '—'}</b>
            </span>
          )}
        </div>
        <dl>
          <div>
            <dt>Wants</dt>
            <dd>{piece.details.motivation || '—'}</dd>
          </div>
          <div>
            <dt>Hook</dt>
            <dd>{piece.details.hook || '—'}</dd>
          </div>
        </dl>
      </article>
    );
  }
  return (
    <main className="role-home keeper-home">
      <header className="home-top">
        <button onClick={onBack}>← All cases</button>
        <div className="entry-brand">
          <Eye />
          <span>THE VEIL</span>
        </div>
        <span>{session.displayName} · Keeper</span>
      </header>
      <section className="keeper-command">
        <aside className="keeper-sidebar">
          <div>
            <span className="case-role keeper">
              <ShieldAlert /> Keeper
            </span>
            <h1>{campaign.name}</h1>
            <p>
              {campaign.location} · {campaign.year}
            </p>
          </div>
          <nav>
            {[
              ['overview', 'Briefing', ClipboardList],
              ['players', 'Investigators', Users],
              ['story', 'Story desk', ScrollText],
              ['cast', 'NPCs & threats', Skull],
              ['loot', 'Loot', Gem],
              ['encounters', 'Encounters', Swords],
              ['imports', 'Creative imports', Sparkles],
            ].map(([id, label, Icon]) => (
              <button
                key={String(id)}
                className={section === id ? 'active' : ''}
                onClick={() => setSection(id as typeof section)}
              >
                <Icon />
                {String(label)}
                <span>
                  {id === 'players'
                    ? campaign.players.length
                    : id === 'story'
                      ? campaign.scenes.length
                      : id === 'cast'
                        ? campaign.pieces.length
                        : id === 'loot'
                          ? campaign.loot.length
                          : id === 'imports'
                            ? campaign.imports?.filter(
                                (i) => i.status === 'pending',
                              ).length || 0
                            : ''}
                </span>
              </button>
            ))}
          </nav>
          <div className="keeper-sidebar-actions">
            <button
              className="join-code"
              onClick={() =>
                void navigator.clipboard.writeText(campaign.joinCode)
              }
            >
              <KeyRound />
              {campaign.joinCode}
              <Copy />
            </button>
            <Button onClick={onBoard}>
              <Map /> Open shared board
            </Button>
          </div>
        </aside>
        <section className="keeper-workspace">
          <header className="keeper-workspace-head">
            <div>
              <span className="eyebrow">KEEPER COMMAND</span>
              <h2>
                {section === 'overview'
                  ? 'Case briefing'
                  : section === 'players'
                    ? 'Investigators'
                    : section === 'story'
                      ? 'Scenes & chapters'
                      : section === 'cast'
                        ? 'NPCs & threats'
                        : section === 'loot'
                          ? 'Evidence & loot'
                          : section === 'encounters'
                            ? 'Encounter desk'
                            : 'Creative integrations'}
              </h2>
            </div>
            <div className="session-control">
              <span
                className={campaign.status === 'live' ? 'live-dot' : 'idle-dot'}
              />
              <b>
                {campaign.status === 'live'
                  ? `Session ${campaign.sessionNumber} live`
                  : 'Table paused'}
              </b>
              <Button
                variant="outline"
                onClick={() => act('startSession')}
                disabled={busy}
              >
                {campaign.status === 'live' ? 'Pause' : 'Go live'}
              </Button>
            </div>
          </header>
          {notice && (
            <div className="keeper-notice">
              <Sparkles />
              <span>{notice}</span>
              <button onClick={() => setNotice('')}>
                <X />
              </button>
            </div>
          )}
          {section === 'overview' && (
            <div className="keeper-overview">
              <article className="brief-scene">
                <span className="eyebrow">CURRENT SCENE</span>
                <h3>{campaign.sceneTitle}</h3>
                <p>{campaign.sceneDescription}</p>
                <div>
                  <Button
                    onClick={() =>
                      openScene(
                        campaign.scenes.find((s) => s.status === 'active'),
                      )
                    }
                  >
                    <FilePenLine /> Edit scene
                  </Button>
                  <button onClick={() => setSection('story')}>
                    Open story desk →
                  </button>
                </div>
              </article>
              <div className="brief-metrics">
                <button onClick={() => setSection('players')}>
                  <Users />
                  <b>{campaign.players.length}</b>
                  <span>Investigators</span>
                  <small>
                    {campaign.players.filter((p) => p.character).length}{' '}
                    dossiers ready
                  </small>
                </button>
                <button onClick={() => setSection('story')}>
                  <ScrollText />
                  <b>{campaign.scenes.length}</b>
                  <span>Scenes</span>
                  <small>
                    {
                      campaign.scenes.filter((s) => s.status === 'complete')
                        .length
                    }{' '}
                    completed
                  </small>
                </button>
                <button onClick={() => setSection('cast')}>
                  <Skull />
                  <b>{campaign.pieces.length}</b>
                  <span>Cast members</span>
                  <small>
                    {campaign.pieces.filter((p) => p.kind === 'mob').length}{' '}
                    threats
                  </small>
                </button>
                <button onClick={() => setSection('loot')}>
                  <Gem />
                  <b>{campaign.loot.length}</b>
                  <span>Loot items</span>
                  <small>
                    {campaign.loot.filter((l) => l.assignedPlayerId).length}{' '}
                    granted
                  </small>
                </button>
              </div>
              <article className="keeper-reference">
                <span className="eyebrow">KEEPER QUICK REFERENCE</span>
                <div>
                  <p>
                    <b>Regular</b> Routine opposition or an unprepared NPC.
                  </p>
                  <p>
                    <b>Hard</b> A professional’s defining skill (about 50%+).
                  </p>
                  <p>
                    <b>Extreme</b> Exceptional opposition (about 90%+); use
                    rarely.
                  </p>
                  <p>
                    <b>Improvised combat</b> Unskilled 25% · Brawler 40% ·
                    Trained killer 70%.
                  </p>
                </div>
              </article>
              <article className="keeper-feed">
                <span className="eyebrow">RECENT GAME LOG</span>
                {campaign.events
                  .slice(-6)
                  .reverse()
                  .map((e) => (
                    <div className="dashboard-event" key={e.id}>
                      <b>{e.actor}</b>
                      <span>{e.message}</span>
                    </div>
                  ))}
              </article>
            </div>
          )}
          {section === 'players' && (
            <div className="keeper-list-layout">
              <div className="keeper-list">
                <div className="list-toolbar">
                  <span>{campaign.players.length} at the table</span>
                  <button
                    onClick={() =>
                      void navigator.clipboard.writeText(campaign.joinCode)
                    }
                  >
                    <Copy /> Copy invite code
                  </button>
                </div>
                {campaign.players.map((p) => (
                  <button
                    key={p.id}
                    className={selectedPlayer === p.id ? 'active' : ''}
                    onClick={() => setSelectedPlayer(p.id)}
                  >
                    <span className="mini-token player">
                      {p.character &&
                      (p.tokenUrl || tokenArt[p.character.name]) ? (
                        <img
                          src={p.tokenUrl || tokenArt[p.character.name]}
                          alt=""
                        />
                      ) : p.character ? (
                        p.character.name.slice(0, 2)
                      ) : (
                        '…'
                      )}
                    </span>
                    <span>
                      <b>{p.character?.name || p.name}</b>
                      <small>
                        {p.character?.occupation || 'Dossier in progress'}
                      </small>
                    </span>
                    {p.character && (
                      <em>
                        {p.character.hp} HP · {p.character.sanity} SAN
                      </em>
                    )}
                  </button>
                ))}
                {campaign.players.length === 0 && (
                  <div className="keeper-empty">
                    <Users />
                    <h3>No investigators yet</h3>
                    <p>
                      Share code <b>{campaign.joinCode}</b> with your players.
                    </p>
                  </div>
                )}
              </div>
              <div className="keeper-detail">
                {player?.character ? (
                  <>
                    <CharacterSheet character={player.character} />
                    <section className="keeper-secrets">
                      <span className="eyebrow">KEEPER-ONLY BACKSTORY</span>
                      <h3>Debt, secret, or failure</h3>
                      <p>{player.character.secret || 'Nothing recorded.'}</p>
                      <h3>Connection</h3>
                      <p>
                        {player.character.connection || 'Nothing recorded.'}
                      </p>
                    </section>
                    <section className="granted-loot">
                      <span className="eyebrow">GRANTED LOOT</span>
                      {campaign.loot
                        .filter((l) => l.assignedPlayerId === player.id)
                        .map((l) => (
                          <p key={l.id}>
                            <Gem />
                            <span>
                              <b>{l.name}</b>
                              <small>{l.description}</small>
                            </span>
                          </p>
                        ))}
                    </section>
                  </>
                ) : (
                  <div className="keeper-empty">
                    <Search />
                    <h3>Select an investigator</h3>
                    <p>Open any completed character sheet from the roster.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {section === 'story' && (
            <div className="story-desk">
              <div className="desk-toolbar">
                <p>
                  Organize chapters, clues, objectives, and private notes. Mark
                  a scene active to reveal it on the shared board.
                </p>
                <Button onClick={() => openScene()}>
                  <Plus /> New scene
                </Button>
              </div>
              <div className="chapter-list">
                {campaign.scenes.map((scene) => (
                  <article key={scene.id} className={scene.status}>
                    <header>
                      <span>{scene.chapter}</span>
                      <b>{scene.status}</b>
                    </header>
                    <h3>{scene.title}</h3>
                    <p>
                      {scene.description || 'No player-facing description yet.'}
                    </p>
                    <dl>
                      <div>
                        <dt>Objective</dt>
                        <dd>{scene.objective || '—'}</dd>
                      </div>
                      <div>
                        <dt>Clues</dt>
                        <dd>{scene.clues || '—'}</dd>
                      </div>
                    </dl>
                    <button onClick={() => openScene(scene)}>
                      <FilePenLine /> Edit scene
                    </button>
                  </article>
                ))}
                {campaign.scenes.length === 0 && (
                  <div className="keeper-empty">
                    <ScrollText />
                    <h3>No planned scenes</h3>
                    <p>
                      Create the opening scene and mark it active when the
                      players arrive.
                    </p>
                    <Button onClick={() => openScene()}>
                      Create first scene
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {section === 'cast' && (
            <div className="cast-desk">
              <div className="desk-toolbar">
                <p>
                  Quick-create an improvised face or build a complete recurring
                  character and threat profile.
                </p>
                <div>
                  <Button
                    variant="outline"
                    onClick={() => quickPiece('npc')}
                    disabled={busy}
                  >
                    <Zap /> Quick NPC
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => quickPiece('mob')}
                    disabled={busy}
                  >
                    <Zap /> Quick MOB
                  </Button>
                  <Button onClick={() => openPiece('npc')}>
                    <UserRoundPlus /> Full NPC
                  </Button>
                  <Button onClick={() => openPiece('mob')}>
                    <Skull /> Full MOB
                  </Button>
                </div>
              </div>
              <section className="cast-group">
                <header>
                  <div>
                    <UserRoundPlus />
                    <h3>NPCs</h3>
                  </div>
                  <span>
                    {
                      campaign.pieces.filter((piece) => piece.kind !== 'mob')
                        .length
                    }
                  </span>
                </header>
                <div className="cast-grid">
                  {campaign.pieces
                    .filter((piece) => piece.kind !== 'mob')
                    .map(castCard)}
                  {campaign.pieces.every((piece) => piece.kind === 'mob') && (
                    <div className="cast-empty">
                      No NPCs in this campaign yet.
                    </div>
                  )}
                </div>
              </section>
              <section className="cast-group threats">
                <header>
                  <div>
                    <Skull />
                    <h3>MOBs & threats</h3>
                  </div>
                  <span>
                    {
                      campaign.pieces.filter((piece) => piece.kind === 'mob')
                        .length
                    }
                  </span>
                </header>
                <div className="cast-grid">
                  {campaign.pieces
                    .filter((piece) => piece.kind === 'mob')
                    .map(castCard)}
                  {campaign.pieces.every((piece) => piece.kind !== 'mob') && (
                    <div className="cast-empty">
                      No MOBs or threats in this campaign yet.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
          {section === 'loot' && (
            <div className="loot-desk">
              <div className="desk-toolbar">
                <p>
                  Generate case-appropriate evidence, valuables, supplies,
                  weapons, and dangerous curios.
                </p>
                <Button
                  onClick={async () => {
                    const data = await act('generateLoot');
                    if (data?.loot) setNotice(`Found: ${data.loot.name}`);
                  }}
                  disabled={busy}
                >
                  <Dices /> Roll random loot
                </Button>
              </div>
              <div className="loot-list">
                {campaign.loot.map((item) => (
                  <article key={item.id}>
                    <Gem />
                    <div>
                      <span>{item.category}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <small>{item.value}</small>
                    </div>
                    <div className="loot-controls">
                      <label>
                        {item.assignedPlayerId ? 'Granted to' : 'Grant to'}
                        <select
                          value={item.assignedPlayerId || ''}
                          onChange={(e) =>
                            e.target.value &&
                            void act('grantLoot', {
                              lootId: item.id,
                              playerId: e.target.value,
                            })
                          }
                          disabled={Boolean(item.assignedPlayerId)}
                        >
                          <option value="">Choose investigator…</option>
                          {campaign.players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.character?.name || p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="delete-action"
                        onClick={() => {
                          if (window.confirm(`Delete ${item.name}?`))
                            void act('deleteLoot', { lootId: item.id });
                        }}
                        disabled={busy}
                      >
                        <Trash2 /> Delete
                      </button>
                    </div>
                  </article>
                ))}
                {campaign.loot.length === 0 && (
                  <div className="keeper-empty">
                    <Coins />
                    <h3>The evidence bag is empty</h3>
                    <p>
                      Roll on the campaign’s original noir and unreality loot
                      table.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {section === 'encounters' && (
            <div className="encounter-desk">
              <section className="encounter-generator">
                <span className="eyebrow">RANDOM ENCOUNTER GENERATOR</span>
                <h3>What trouble finds them?</h3>
                <p>
                  Give the generator a location, mood, faction, or immediate
                  situation. Leave it blank for a fully random encounter.
                </p>
                <div>
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Rainy studio backlot, Quiet Choir watching…"
                  />
                  <Button
                    onClick={async () => {
                      const data = await act('generateEncounter', { prompt });
                      if (data?.encounter) setEncounter(data.encounter);
                    }}
                    disabled={busy}
                  >
                    <Sparkles /> Generate encounter
                  </Button>
                </div>
              </section>
              {encounter ? (
                <article className="encounter-card">
                  <header>
                    <span className="case-role keeper">
                      <Swords /> Ready to run
                    </span>
                    <h3>{encounter.title}</h3>
                  </header>
                  <dl>
                    <div>
                      <dt>Opening hook</dt>
                      <dd>{encounter.hook}</dd>
                    </div>
                    <div>
                      <dt>Opposition</dt>
                      <dd>{encounter.opposition}</dd>
                    </div>
                    <div>
                      <dt>Discoverable clue</dt>
                      <dd>{encounter.clue}</dd>
                    </div>
                    <div>
                      <dt>Complication</dt>
                      <dd>{encounter.complication}</dd>
                    </div>
                    <div>
                      <dt>Stakes</dt>
                      <dd>{encounter.stakes}</dd>
                    </div>
                    <div>
                      <dt>Suggested difficulty</dt>
                      <dd>{encounter.difficulty}</dd>
                    </div>
                    <div>
                      <dt>Suggested SAN loss</dt>
                      <dd>{encounter.sanityLoss}</dd>
                    </div>
                  </dl>
                  <footer>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPieceDraft({
                          name: encounter.opposition,
                          hp: 12,
                          hidden: false,
                          details: quickDetails('mob'),
                        });
                        setEditingId('');
                        setEditor('mob');
                      }}
                    >
                      <Skull /> Turn opposition into MOB
                    </Button>
                  </footer>
                </article>
              ) : (
                <div className="keeper-empty">
                  <Swords />
                  <h3>No encounter on the desk</h3>
                  <p>
                    Generate a modular situation you can drop into the current
                    scene.
                  </p>
                </div>
              )}
            </div>
          )}
          {section === 'imports' && (
            <div className="integration-desk">
              <section className="integration-keys">
                <div className="desk-toolbar">
                  <div>
                    <span className="eyebrow">CAMPAIGN API ACCESS</span>
                    <h3>Creative workflow tokens</h3>
                    <p>
                      Scoped to this campaign. They can read approved creative
                      context, submit drafts, and stage generated media, but
                      cannot change the live game without your approval.
                    </p>
                  </div>
                </div>
                <div className="token-create">
                  <input
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="Token name"
                  />
                  <Button
                    onClick={async () => {
                      const data = await act('createIntegrationToken', {
                        name: tokenName,
                      });
                      if (data?.token) setNewToken(data.token);
                    }}
                  >
                    <KeyRound /> Create token
                  </Button>
                </div>
                {newToken && (
                  <div className="token-secret">
                    <b>Copy this token now—it will not be shown again.</b>
                    <code>{newToken}</code>
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(newToken)
                      }
                    >
                      <Copy /> Copy token
                    </button>
                    <button onClick={() => setNewToken('')}>Done</button>
                  </div>
                )}
                <div className="token-list">
                  {(campaign.integrationTokens || []).map((t) => (
                    <article key={t.id} className={t.revoked ? 'revoked' : ''}>
                      <div>
                        <b>{t.name}</b>
                        <code>{t.prefix}…</code>
                        <small>
                          {t.scopes.join(' · ')}
                          {t.lastUsedAt
                            ? ` · Used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                            : ' · Never used'}
                        </small>
                      </div>
                      {!t.revoked && (
                        <button
                          onClick={() =>
                            void act('revokeIntegrationToken', {
                              tokenId: t.id,
                            })
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                <a
                  className="openapi-link"
                  href="/api/v1/openapi"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ScrollText /> OpenAPI 3.1 document
                </a>
              </section>
              <section className="staging-inbox">
                <div className="desk-toolbar">
                  <div>
                    <span className="eyebrow">STAGING INBOX</span>
                    <h3>Generated content awaiting review</h3>
                    <p>
                      Nothing enters the campaign until you approve it here.
                    </p>
                  </div>
                  <b>
                    {
                      (campaign.imports || []).filter(
                        (i) => i.status === 'pending',
                      ).length
                    }{' '}
                    pending
                  </b>
                </div>
                {(campaign.imports || []).map((item) => (
                  <article key={item.id} className={item.status}>
                    <header>
                      <div>
                        <span>{item.source}</span>
                        <h3>{item.title}</h3>
                        <small>
                          {new Date(item.createdAt).toLocaleString()}
                        </small>
                      </div>
                      <b>{item.status}</b>
                    </header>
                    <div className="import-counts">
                      <span>{item.contents.scenes} scenes</span>
                      <span>{item.contents.cast} cast</span>
                      <span>{item.contents.handouts} handouts</span>
                      <span>{item.contents.encounters} encounters</span>
                    </div>
                    {item.status === 'pending' && (
                      <footer>
                        <button
                          className="delete-action"
                          onClick={() =>
                            void act('deleteImport', { importId: item.id })
                          }
                        >
                          <Trash2 /> Reject
                        </button>
                        <Button
                          onClick={() =>
                            void act('approveImport', { importId: item.id })
                          }
                        >
                          <Sparkles /> Approve into campaign
                        </Button>
                      </footer>
                    )}
                  </article>
                ))}
                {!(campaign.imports || []).length && (
                  <div className="keeper-empty">
                    <Sparkles />
                    <h3>The inbox is empty</h3>
                    <p>
                      Create an integration token, then use the REST API to
                      stage a content package.
                    </p>
                  </div>
                )}
                {!!(campaign.integrationAssets || []).length && (
                  <div className="desk-toolbar">
                    <div>
                      <span className="eyebrow">GENERATED MEDIA</span>
                      <h3>Maps, tokens, portraits, and handouts</h3>
                    </div>
                  </div>
                )}
                {(campaign.integrationAssets || []).map((asset) => (
                  <article key={asset.id} className={asset.status}>
                    <header>
                      <div>
                        <span>{asset.kind}</span>
                        <h3>{asset.name}</h3>
                        <small>
                          {(asset.byteSize / 1024 / 1024).toFixed(1)} MB ·{' '}
                          {new Date(asset.createdAt).toLocaleString()}
                        </small>
                      </div>
                      <b>{asset.status}</b>
                    </header>
                    <footer>
                      {asset.status === 'approved' && (
                        <a
                          className="openapi-link"
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open asset
                        </a>
                      )}
                      <button
                        className="delete-action"
                        onClick={() =>
                          void act('deleteIntegrationAsset', {
                            assetId: asset.id,
                          })
                        }
                      >
                        <Trash2 /> Delete
                      </button>
                      {asset.status === 'pending' && (
                        <Button
                          onClick={() =>
                            void act('approveIntegrationAsset', {
                              assetId: asset.id,
                            })
                          }
                        >
                          <Sparkles /> Approve media
                        </Button>
                      )}
                    </footer>
                  </article>
                ))}
              </section>
            </div>
          )}
        </section>
      </section>
      {editor && (
        <div
          className="modal-backdrop keeper-modal-backdrop"
          onMouseDown={() => setEditor(null)}
        >
          <section
            className="modal-card keeper-editor-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <div className="entry-brand">
                <Eye />
                <span>
                  {editor === 'scene'
                    ? editingId
                      ? 'EDIT SCENE'
                      : 'NEW SCENE'
                    : editingId
                      ? `EDIT ${editor.toUpperCase()}`
                      : `FULL ${editor.toUpperCase()}`}
                </span>
              </div>
              <button onClick={() => setEditor(null)}>
                <X />
              </button>
            </header>
            {editor === 'scene' ? (
              <div className="keeper-form">
                <div className="form-pair">
                  <label>
                    Chapter
                    <input
                      value={sceneDraft.chapter}
                      onChange={(e) =>
                        setSceneDraft({
                          ...sceneDraft,
                          chapter: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={sceneDraft.status}
                      onChange={(e) =>
                        setSceneDraft({ ...sceneDraft, status: e.target.value })
                      }
                    >
                      <option value="planned">Planned</option>
                      <option value="active">Active on board</option>
                      <option value="complete">Complete</option>
                    </select>
                  </label>
                </div>
                <label>
                  Scene title
                  <input
                    autoFocus
                    value={sceneDraft.title}
                    onChange={(e) =>
                      setSceneDraft({ ...sceneDraft, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  What investigators see
                  <textarea
                    value={sceneDraft.description}
                    onChange={(e) =>
                      setSceneDraft({
                        ...sceneDraft,
                        description: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Keeper objective
                  <textarea
                    value={sceneDraft.objective}
                    onChange={(e) =>
                      setSceneDraft({
                        ...sceneDraft,
                        objective: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Clues available here
                  <textarea
                    value={sceneDraft.clues}
                    onChange={(e) =>
                      setSceneDraft({ ...sceneDraft, clues: e.target.value })
                    }
                    placeholder="One clue per line…"
                  />
                </label>
                <label>
                  Private Keeper notes
                  <textarea
                    value={sceneDraft.keeperNotes}
                    onChange={(e) =>
                      setSceneDraft({
                        ...sceneDraft,
                        keeperNotes: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ) : (
              <PieceEditor
                kind={editor}
                draft={pieceDraft}
                setDraft={setPieceDraft}
              />
            )}
            <div className="modal-actions">
              <button onClick={() => setEditor(null)}>Cancel</button>
              <Button onClick={saveEditor} disabled={busy}>
                {busy ? 'Filing…' : 'Save to campaign'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function PieceEditor({
  kind,
  draft,
  setDraft,
}: {
  kind: 'npc' | 'mob';
  draft: { name: string; hp: number; hidden: boolean; details: PieceDetails };
  setDraft: (v: {
    name: string;
    hp: number;
    hidden: boolean;
    details: PieceDetails;
  }) => void;
}) {
  const d = draft.details,
    stats = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow'] as const;
  return (
    <div className="keeper-form piece-editor">
      <div className="form-pair">
        <label>
          Name
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          {kind === 'npc' ? 'Occupation / role' : 'Threat type'}
          <input
            value={d.occupation || ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                details: { ...d, occupation: e.target.value },
              })
            }
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          value={d.description || ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              details: { ...d, description: e.target.value },
            })
          }
        />
      </label>
      <div className="form-pair">
        <label>
          What they want
          <textarea
            value={d.motivation || ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                details: { ...d, motivation: e.target.value },
              })
            }
          />
        </label>
        <label>
          Roleplaying / story hook
          <textarea
            value={d.hook || ''}
            onChange={(e) =>
              setDraft({ ...draft, details: { ...d, hook: e.target.value } })
            }
          />
        </label>
      </div>
      <label>
        Secret or hidden truth
        <textarea
          value={d.secret || ''}
          onChange={(e) =>
            setDraft({ ...draft, details: { ...d, secret: e.target.value } })
          }
        />
      </label>
      <h3>Characteristics</h3>
      <div className="piece-stats">
        {stats.map((k) => (
          <label key={k}>
            {k.toUpperCase()}
            <input
              type="number"
              min="0"
              max="999"
              value={d[k] || ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  details: { ...d, [k]: Number(e.target.value) },
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="form-pair">
        <label>
          Hit points
          <input
            type="number"
            min="0"
            max="999"
            value={draft.hp}
            onChange={(e) => setDraft({ ...draft, hp: Number(e.target.value) })}
          />
        </label>
        <label>
          Fighting %
          <input
            type="number"
            min="0"
            max="999"
            value={d.fighting || ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                details: { ...d, fighting: Number(e.target.value) },
              })
            }
          />
        </label>
      </div>
      {kind === 'mob' && (
        <>
          <div className="form-pair">
            <label>
              Damage
              <input
                value={d.damage || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    details: { ...d, damage: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Armor
              <input
                value={d.armor || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    details: { ...d, armor: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              SAN loss
              <input
                value={d.sanityLoss || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    details: { ...d, sanityLoss: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Attacks / powers
              <textarea
                value={d.attacks || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    details: { ...d, attacks: e.target.value },
                  })
                }
              />
            </label>
          </div>
        </>
      )}
      <label>
        Private Keeper notes
        <textarea
          value={d.notes || ''}
          onChange={(e) =>
            setDraft({ ...draft, details: { ...d, notes: e.target.value } })
          }
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={draft.hidden}
          onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })}
        />{' '}
        Hide this piece from players
      </label>
    </div>
  );
}

async function makeCoin(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const radius = 238;
  ctx.clearRect(0, 0, 512, 512);
  ctx.save();
  ctx.beginPath();
  ctx.arc(256, 256, radius, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max(
    (radius * 2) / bitmap.width,
    (radius * 2) / bitmap.height,
  );
  const w = bitmap.width * scale,
    h = bitmap.height * scale;
  ctx.drawImage(bitmap, (512 - w) / 2, (512 - h) / 2, w, h);
  const vignette = ctx.createRadialGradient(256, 220, 120, 256, 256, 245);
  vignette.addColorStop(0.55, 'transparent');
  vignette.addColorStop(1, 'rgba(5,7,6,.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 512, 512);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(256, 256, radius + 5, 0, Math.PI * 2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#6f5429';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(256, 256, radius - 5, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#d1b16e';
  ctx.stroke();
  bitmap.close();
  return canvas.toDataURL('image/png');
}

function BoardMarkShape({ mark }: { mark: BoardMark }) {
  const d = mark.data,
    x2 = d.x2 ?? d.x,
    y2 = d.y2 ?? d.y,
    color = d.color || '#d7c28f';
  if (mark.kind === 'freehand')
    return (
      <polyline
        points={(d.points || []).map((p) => `${p.x},${p.y}`).join(' ')}
        stroke={color}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    );
  if (mark.kind === 'circle')
    return (
      <ellipse
        cx={(d.x + x2) / 2}
        cy={(d.y + y2) / 2}
        rx={Math.abs(x2 - d.x) / 2}
        ry={Math.abs(y2 - d.y) / 2}
        stroke={color}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    );
  if (mark.kind === 'rect' || mark.kind === 'fog')
    return (
      <rect
        x={Math.min(d.x, x2)}
        y={Math.min(d.y, y2)}
        width={Math.abs(x2 - d.x)}
        height={Math.abs(y2 - d.y)}
        stroke={color}
        fill={mark.kind === 'fog' ? 'rgba(2,5,4,.96)' : 'rgba(185,143,76,.08)'}
        vectorEffect="non-scaling-stroke"
      />
    );
  return (
    <g>
      <line
        x1={d.x}
        y1={d.y}
        x2={x2}
        y2={y2}
        stroke={color}
        vectorEffect="non-scaling-stroke"
      />
      {mark.kind === 'ruler' && (
        <text x={(d.x + x2) / 2} y={(d.y + y2) / 2 - 1} textAnchor="middle">
          {d.label}
        </text>
      )}
    </g>
  );
}

function PlayerHome({
  session,
  campaign,
  initialSection,
  onSection,
  onCampaign,
  onBoard,
  onBack,
}: {
  session: Session;
  campaign: Campaign;
  initialSection: string;
  onSection: (section: PlayerSection) => void;
  onCampaign: (c: Campaign) => void;
  onBoard: () => void;
  onBack: () => void;
}) {
  const playerSections: PlayerSection[] = ['sheet', 'edit', 'notes', 'gear'];
  const player = campaign.players.find((p) => p.id === session.playerId);
  const c = player?.character ?? blankCharacter;
  const [uploading, setUploading] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [section, setSection] = useState<PlayerSection>(
    playerSections.includes(initialSection as PlayerSection)
      ? (initialSection as PlayerSection)
      : 'sheet',
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const image = player?.tokenUrl || tokenArt[c.name];
  useEffect(() => onSection(section), [section]); // eslint-disable-line react-hooks/exhaustive-deps
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setTokenError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setTokenError('Choose an image smaller than 12 MB.');
      return;
    }
    setUploading(true);
    setTokenError('');
    try {
      const data = await api({
        action: 'uploadToken',
        campaignId: campaign.id,
        image: await makeCoin(file),
      });
      onCampaign(data.campaign);
    } catch (err) {
      setTokenError(
        err instanceof Error ? err.message : 'Could not create token.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  return (
    <main className="role-home player-home">
      <header className="home-top">
        <button onClick={onBack}>← All cases</button>
        <div className="entry-brand">
          <Eye />
          <span>THE VEIL</span>
        </div>
        <span>{session.displayName} · Player</span>
      </header>
      <section className="player-dossier">
        <aside>
          <span className="eyebrow">INVESTIGATOR DOSSIER</span>
          <div className="dossier-portrait coin-preview">
            {image ? (
              <img src={image} alt={`${c.name} token`} />
            ) : (
              <UserRoundPlus />
            )}
          </div>
          <input
            ref={inputRef}
            className="token-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <button
            className="token-upload"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus />
            {uploading
              ? 'Minting token…'
              : image
                ? 'Replace token image'
                : 'Upload token image'}
          </button>
          <p className="token-help">
            Your photo is center-cropped into a circular brass-rimmed coin.
          </p>
          {tokenError && <p className="form-error">{tokenError}</p>}
          <h1>{c.name}</h1>
          <p>{c.occupation}</p>
          <div className="dossier-vitals">
            <span>
              HP <b>{c.hp}</b>
            </span>
            <span>
              SAN <b>{c.sanity}</b>
            </span>
            <span>
              MP <b>{c.mp}</b>
            </span>
            <span>
              LUCK <b>{c.luck}</b>
            </span>
          </div>
          <Button onClick={onBoard}>
            <Map /> Join the board
          </Button>
          <small>
            {campaign.status === 'live'
              ? `Session ${campaign.sessionNumber} is live`
              : 'The shared board is currently paused'}
          </small>
        </aside>
        <section>
          <nav className="dossier-tabs">
            <button
              className={section === 'sheet' ? 'active' : ''}
              onClick={() => setSection('sheet')}
            >
              <BookOpen /> Character sheet
            </button>
            <button
              className={section === 'edit' ? 'active' : ''}
              onClick={() => setSection('edit')}
            >
              <FilePenLine /> Edit investigator
            </button>
            <button
              className={section === 'notes' ? 'active' : ''}
              onClick={() => setSection('notes')}
            >
              <Pencil /> Private notes
            </button>
            <button
              className={section === 'gear' ? 'active' : ''}
              onClick={() => setSection('gear')}
            >
              <Gem /> Gear & loot
            </button>
          </nav>
          {section === 'sheet' && <CharacterSheet character={c} />}{' '}
          {section === 'edit' && (
            <CharacterEditor
              character={c}
              campaignId={campaign.id}
              onSaved={(next) => {
                onCampaign(next);
                setSection('sheet');
              }}
            />
          )}
          {section === 'notes' && (
            <NotesEditor
              campaignId={campaign.id}
              initial={campaign.playerNotes}
              onSaved={onCampaign}
            />
          )}{' '}
          {section === 'gear' && (
            <section className="player-loot">
              <span className="eyebrow">GRANTED BY THE KEEPER</span>
              <h2>Gear & discovered items</h2>
              {campaign.loot.length ? (
                campaign.loot.map((item) => (
                  <article key={item.id}>
                    <Gem />
                    <div>
                      <b>{item.name}</b>
                      <p>{item.description}</p>
                      <small>
                        {item.category} · {item.value}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="keeper-empty">
                  <Box />
                  <h3>Nothing recorded yet</h3>
                  <p>Items granted by your Keeper will appear here.</p>
                </div>
              )}
            </section>
          )}
          <article className="case-brief">
            <span className="eyebrow">CURRENT CASE</span>
            <h2>{campaign.name}</h2>
            <h3>{campaign.sceneTitle}</h3>
            <p>{campaign.sceneDescription}</p>
          </article>
        </section>
      </section>
    </main>
  );
}

function SkillEditor({
  character,
  onChange,
  paper = false,
}: {
  character: Character;
  onChange: (skills: Record<string, number>) => void;
  paper?: boolean;
}) {
  const skills = resolvedSkills(character);
  return (
    <div className={`skill-editor ${paper ? 'paper-skills' : ''}`}>
      {skillCatalog.map(([key, label, base]) => (
        <label key={key}>
          <span>
            {label}
            <small>
              Base{' '}
              {key === 'dodge'
                ? Math.floor(character.dex / 2)
                : key === 'languageOwn'
                  ? character.edu
                  : key === 'creditRating'
                    ? character.credit
                    : base}
              %
            </small>
          </span>
          <input
            type="number"
            min="0"
            max="99"
            value={skills[key]}
            onChange={(e) =>
              onChange({
                ...skills,
                [key]: Math.max(0, Math.min(99, Number(e.target.value))),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}

function OccupationPanel({
  c,
  setC,
}: {
  c: Character;
  setC: (c: Character) => void;
}) {
  const selected = new Set(c.occupationSkillKeys || []),
    skills = resolvedSkills(c),
    spent = skillCatalog.reduce(
      (n, [key, , base]) =>
        selected.has(key)
          ? n +
            Math.max(
              0,
              skills[key] -
                (key === 'dodge'
                  ? Math.floor(c.dex / 2)
                  : key === 'languageOwn'
                    ? c.edu
                    : key === 'creditRating'
                      ? 0
                      : base),
            )
          : n,
      0,
    );
  function choose(name: string) {
    const t = occupationTemplates.find((o) => o.name === name);
    if (t)
      setC({
        ...c,
        occupation: t.name,
        occupationFormula: t.formula,
        occupationSkillKeys: [...t.skills],
      });
  }
  return (
    <section className="mechanics-card">
      <h3>Occupation & point budget</h3>
      <div className="form-pair">
        <label>
          Occupation template
          <select
            value={
              occupationTemplates.some((o) => o.name === c.occupation)
                ? c.occupation
                : ''
            }
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Custom occupation</option>
            {occupationTemplates.map((o) => (
              <option key={o.name}>{o.name}</option>
            ))}
          </select>
        </label>
        <label>
          Point formula
          <select
            value={c.occupationFormula || 'edu4'}
            onChange={(e) =>
              setC({
                ...c,
                occupationFormula: e.target
                  .value as Character['occupationFormula'],
              })
            }
          >
            <option value="edu4">EDU × 4</option>
            <option value="edu2app2">EDU × 2 + APP × 2</option>
            <option value="edu2dex2">EDU × 2 + DEX × 2</option>
            <option value="edu2str2">EDU × 2 + STR × 2</option>
            <option value="edu2pow2">EDU × 2 + POW × 2</option>
          </select>
        </label>
      </div>
      <div className="budget-line">
        <span>
          Occupation points{' '}
          <b>
            {spent} / {occupationPoints(c)}
          </b>
        </span>
        <span>
          Personal-interest allowance <b>{c.int * 2}</b>
        </span>
      </div>
      <p>
        Mark the skills belonging to this occupation. Credit Rating must also
        fall within the range agreed with your Keeper.
      </p>
      <div className="occupation-picks">
        {skillCatalog.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={selected.has(key) ? 'active' : ''}
            onClick={() =>
              setC({
                ...c,
                occupationSkillKeys: selected.has(key)
                  ? [...selected].filter((v) => v !== key)
                  : [...selected, key],
              })
            }
          >
            {selected.has(key) ? '✓ ' : ''}
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function CustomSkillsEditor({
  c,
  setC,
}: {
  c: Character;
  setC: (c: Character) => void;
}) {
  return (
    <section className="mechanics-card">
      <header>
        <div>
          <h3>Languages & specializations</h3>
          <p>
            Add languages, sciences, arts, survival regions, or any
            campaign-specific skill.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setC({
              ...c,
              customSkills: [
                ...(c.customSkills || []),
                {
                  id: crypto.randomUUID(),
                  name: 'New specialization',
                  base: 1,
                  value: 1,
                },
              ],
            })
          }
        >
          <Plus /> Add
        </button>
      </header>
      <div className="custom-skill-list">
        {(c.customSkills || []).map((s) => (
          <div key={s.id}>
            <input
              aria-label="Skill name"
              value={s.name}
              onChange={(e) =>
                setC({
                  ...c,
                  customSkills: c.customSkills!.map((v) =>
                    v.id === s.id ? { ...v, name: e.target.value } : v,
                  ),
                })
              }
            />
            <label>
              Base
              <input
                type="number"
                min="0"
                max="99"
                value={s.base}
                onChange={(e) =>
                  setC({
                    ...c,
                    customSkills: c.customSkills!.map((v) =>
                      v.id === s.id
                        ? { ...v, base: Number(e.target.value) }
                        : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Total
              <input
                type="number"
                min="0"
                max="99"
                value={s.value}
                onChange={(e) =>
                  setC({
                    ...c,
                    customSkills: c.customSkills!.map((v) =>
                      v.id === s.id
                        ? { ...v, value: Number(e.target.value) }
                        : v,
                    ),
                  })
                }
              />
            </label>
            <button
              aria-label="Delete skill"
              onClick={() =>
                setC({
                  ...c,
                  customSkills: c.customSkills!.filter((v) => v.id !== s.id),
                })
              }
            >
              <Trash2 />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MechanicsEditor({
  c,
  setC,
}: {
  c: Character;
  setC: (c: Character) => void;
}) {
  const d = derivedStats(c),
    funds = finances(c.credit);
  function addWeapon() {
    setC({
      ...c,
      weapons: [
        ...(c.weapons || []),
        {
          id: crypto.randomUUID(),
          name: 'Revolver',
          skillKey: 'firearmsHandgun',
          skillName: 'Firearms (Handgun)',
          damage: '1D10',
          range: '15 yards',
          attacks: '1',
          ammo: 6,
          maxAmmo: 6,
          malfunction: 100,
        },
      ],
    });
  }
  function weapon(id: string, patch: Partial<CharacterWeapon>) {
    setC({
      ...c,
      weapons: (c.weapons || []).map((w) =>
        w.id === id ? { ...w, ...patch } : w,
      ),
    });
  }
  return (
    <div className="mechanics-stack">
      <section className="mechanics-card">
        <h3>Derived combat values</h3>
        <div className="derived-mechanics">
          <span>
            MOV <b>{d.mov}</b>
          </span>
          <span>
            Build <b>{d.build}</b>
          </span>
          <span>
            Damage bonus <b>{d.damageBonus}</b>
          </span>
          <span>
            Maximum HP <b>{d.maxHp}</b>
          </span>
        </div>
      </section>
      <section className="mechanics-card">
        <header>
          <div>
            <h3>Weapons</h3>
            <p>Attacks and damage become roll buttons on the VTT.</p>
          </div>
          <button type="button" onClick={addWeapon}>
            <Plus /> Add weapon
          </button>
        </header>
        <div className="weapon-list">
          {(c.weapons || []).map((w) => (
            <div key={w.id}>
              <input
                value={w.name}
                onChange={(e) => weapon(w.id, { name: e.target.value })}
                placeholder="Weapon"
              />
              <select
                value={w.skillKey}
                onChange={(e) => {
                  const found = allSkills(c).find(
                    (s) => s.key === e.target.value,
                  );
                  weapon(w.id, {
                    skillKey: e.target.value,
                    skillName: found?.label || 'Combat',
                  });
                }}
              >
                {allSkills(c).map((s) => (
                  <option value={s.key} key={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                value={w.damage}
                onChange={(e) => weapon(w.id, { damage: e.target.value })}
                placeholder="1D10"
              />
              <input
                value={w.range}
                onChange={(e) => weapon(w.id, { range: e.target.value })}
                placeholder="Range"
              />
              <label>
                Ammo
                <input
                  type="number"
                  value={w.ammo}
                  onChange={(e) =>
                    weapon(w.id, { ammo: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Malfunction
                <input
                  type="number"
                  value={w.malfunction}
                  onChange={(e) =>
                    weapon(w.id, { malfunction: Number(e.target.value) })
                  }
                />
              </label>
              <button
                aria-label="Delete weapon"
                onClick={() =>
                  setC({
                    ...c,
                    weapons: c.weapons!.filter((v) => v.id !== w.id),
                  })
                }
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="mechanics-card">
        <h3>Wounds & conditions</h3>
        <div className="condition-picks">
          {conditionCatalog.map((name) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={(c.conditions || []).includes(name)}
                onChange={() =>
                  setC({
                    ...c,
                    conditions: (c.conditions || []).includes(name)
                      ? c.conditions!.filter((v) => v !== name)
                      : [...(c.conditions || []), name],
                  })
                }
              />
              {name}
            </label>
          ))}
        </div>
      </section>
      <section className="mechanics-card">
        <header>
          <div>
            <h3>Sanity episodes</h3>
            <p>Track bouts, phobias, manias, and indefinite insanity.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setC({
                ...c,
                sanityEpisodes: [
                  ...(c.sanityEpisodes || []),
                  {
                    id: crypto.randomUUID(),
                    kind: 'bout',
                    name: 'New episode',
                    notes: '',
                  },
                ],
              })
            }
          >
            <Plus /> Add
          </button>
        </header>
        <div className="episode-list">
          {(c.sanityEpisodes || []).map((ep) => (
            <div key={ep.id}>
              <select
                value={ep.kind}
                onChange={(e) =>
                  setC({
                    ...c,
                    sanityEpisodes: c.sanityEpisodes!.map((v) =>
                      v.id === ep.id
                        ? { ...v, kind: e.target.value as typeof ep.kind }
                        : v,
                    ),
                  })
                }
              >
                <option value="bout">Bout</option>
                <option value="phobia">Phobia</option>
                <option value="mania">Mania</option>
                <option value="indefinite">Indefinite insanity</option>
              </select>
              <input
                value={ep.name}
                onChange={(e) =>
                  setC({
                    ...c,
                    sanityEpisodes: c.sanityEpisodes!.map((v) =>
                      v.id === ep.id ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
              <input
                value={ep.notes}
                onChange={(e) =>
                  setC({
                    ...c,
                    sanityEpisodes: c.sanityEpisodes!.map((v) =>
                      v.id === ep.id ? { ...v, notes: e.target.value } : v,
                    ),
                  })
                }
                placeholder="Trigger, duration, effect…"
              />
              <button
                onClick={() =>
                  setC({
                    ...c,
                    sanityEpisodes: c.sanityEpisodes!.filter(
                      (v) => v.id !== ep.id,
                    ),
                  })
                }
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
        <p>
          Mythos maximum SAN:{' '}
          <b>{99 - (resolvedSkills(c).cthulhuMythos || 0)}</b>
        </p>
      </section>
      <section className="mechanics-card">
        <h3>Finances & possessions</h3>
        <div className="derived-mechanics">
          <span>
            Cash <b>{c.cash || funds.cash}</b>
          </span>
          <span>
            Assets <b>{c.assets || funds.assets}</b>
          </span>
          <span>
            Spending level <b>{c.spendingLevel || funds.spendingLevel}</b>
          </span>
        </div>
        <label>
          Possessions & equipment
          <textarea
            value={c.possessions || ''}
            onChange={(e) => setC({ ...c, possessions: e.target.value })}
            placeholder="Clothing, tools, transport, weapons, keepsakes…"
          />
        </label>
      </section>
      <AdvancedMechanicsEditor c={c} setC={setC} />
    </div>
  );
}

function AdvancedMechanicsEditor({
  c,
  setC,
}: {
  c: Character;
  setC: (c: Character) => void;
}) {
  const chase = c.chase || {
    speed: c.mov || derivedStats(c).mov,
    actionPoints: 1,
    location: '',
    vehicle: '',
    vehicleBuild: 0,
    notes: '',
  };
  return (
    <>
      <section className="mechanics-card">
        <h3>Chase record</h3>
        <div className="advanced-grid">
          <label>
            Speed
            <input
              type="number"
              value={chase.speed}
              onChange={(e) =>
                setC({
                  ...c,
                  chase: { ...chase, speed: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Action points
            <input
              type="number"
              min="0"
              value={chase.actionPoints}
              onChange={(e) =>
                setC({
                  ...c,
                  chase: { ...chase, actionPoints: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Current location
            <input
              value={chase.location}
              onChange={(e) =>
                setC({ ...c, chase: { ...chase, location: e.target.value } })
              }
            />
          </label>
          <label>
            Vehicle
            <input
              value={chase.vehicle}
              onChange={(e) =>
                setC({ ...c, chase: { ...chase, vehicle: e.target.value } })
              }
            />
          </label>
          <label>
            Vehicle Build
            <input
              type="number"
              value={chase.vehicleBuild}
              onChange={(e) =>
                setC({
                  ...c,
                  chase: { ...chase, vehicleBuild: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Chase notes
            <input
              value={chase.notes}
              onChange={(e) =>
                setC({ ...c, chase: { ...chase, notes: e.target.value } })
              }
            />
          </label>
        </div>
      </section>
      <section className="mechanics-card">
        <header>
          <div>
            <h3>Temporary modifiers</h3>
            <p>Buffs, injuries, circumstances, and other temporary effects.</p>
          </div>
          <button
            onClick={() =>
              setC({
                ...c,
                modifiers: [
                  ...(c.modifiers || []),
                  {
                    id: crypto.randomUUID(),
                    name: 'New modifier',
                    target: 'all',
                    amount: 0,
                    expires: 'End of scene',
                  },
                ],
              })
            }
          >
            <Plus /> Add
          </button>
        </header>
        <div className="advanced-list">
          {(c.modifiers || []).map((m) => (
            <div key={m.id}>
              <input
                value={m.name}
                onChange={(e) =>
                  setC({
                    ...c,
                    modifiers: c.modifiers!.map((v) =>
                      v.id === m.id ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
              <select
                value={m.target}
                onChange={(e) =>
                  setC({
                    ...c,
                    modifiers: c.modifiers!.map((v) =>
                      v.id === m.id ? { ...v, target: e.target.value } : v,
                    ),
                  })
                }
              >
                <option value="all">All checks</option>
                {allSkills(c).map((s) => (
                  <option value={s.key} key={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={m.amount}
                onChange={(e) =>
                  setC({
                    ...c,
                    modifiers: c.modifiers!.map((v) =>
                      v.id === m.id
                        ? { ...v, amount: Number(e.target.value) }
                        : v,
                    ),
                  })
                }
              />
              <input
                value={m.expires}
                onChange={(e) =>
                  setC({
                    ...c,
                    modifiers: c.modifiers!.map((v) =>
                      v.id === m.id ? { ...v, expires: e.target.value } : v,
                    ),
                  })
                }
              />
              <button
                onClick={() =>
                  setC({
                    ...c,
                    modifiers: c.modifiers!.filter((v) => v.id !== m.id),
                  })
                }
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="mechanics-card">
        <header>
          <div>
            <h3>Spells</h3>
            <p>
              Costs are recorded here and casting buttons appear on the VTT.
            </p>
          </div>
          <button
            onClick={() =>
              setC({
                ...c,
                spells: [
                  ...(c.spells || []),
                  {
                    id: crypto.randomUUID(),
                    name: 'New spell',
                    cost: '1 MP',
                    castingTime: '1 round',
                    description: '',
                    sanityCost: '0',
                  },
                ],
              })
            }
          >
            <Plus /> Add
          </button>
        </header>
        <div className="spell-list">
          {(c.spells || []).map((s) => (
            <div key={s.id}>
              <input
                value={s.name}
                onChange={(e) =>
                  setC({
                    ...c,
                    spells: c.spells!.map((v) =>
                      v.id === s.id ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
              <input
                value={s.cost}
                onChange={(e) =>
                  setC({
                    ...c,
                    spells: c.spells!.map((v) =>
                      v.id === s.id ? { ...v, cost: e.target.value } : v,
                    ),
                  })
                }
                placeholder="MP/POW cost"
              />
              <input
                value={s.sanityCost}
                onChange={(e) =>
                  setC({
                    ...c,
                    spells: c.spells!.map((v) =>
                      v.id === s.id ? { ...v, sanityCost: e.target.value } : v,
                    ),
                  })
                }
                placeholder="SAN cost"
              />
              <input
                value={s.castingTime}
                onChange={(e) =>
                  setC({
                    ...c,
                    spells: c.spells!.map((v) =>
                      v.id === s.id ? { ...v, castingTime: e.target.value } : v,
                    ),
                  })
                }
              />
              <textarea
                value={s.description}
                onChange={(e) =>
                  setC({
                    ...c,
                    spells: c.spells!.map((v) =>
                      v.id === s.id ? { ...v, description: e.target.value } : v,
                    ),
                  })
                }
                placeholder="Effect, requirements, and risks…"
              />
              <button
                onClick={() =>
                  setC({ ...c, spells: c.spells!.filter((v) => v.id !== s.id) })
                }
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="mechanics-card">
        <header>
          <div>
            <h3>Mythos tomes</h3>
            <p>Track study progress, gains, losses, and contained spells.</p>
          </div>
          <button
            onClick={() =>
              setC({
                ...c,
                tomes: [
                  ...(c.tomes || []),
                  {
                    id: crypto.randomUUID(),
                    title: 'Untitled tome',
                    language: 'English',
                    studyTime: '',
                    mythosGain: '',
                    sanityLoss: '',
                    spells: '',
                    notes: '',
                  },
                ],
              })
            }
          >
            <Plus /> Add
          </button>
        </header>
        <div className="tome-list">
          {(c.tomes || []).map((t) => (
            <div key={t.id}>
              {(
                [
                  ['title', 'Title'],
                  ['language', 'Language'],
                  ['studyTime', 'Study time'],
                  ['mythosGain', 'Mythos gain'],
                  ['sanityLoss', 'SAN loss'],
                  ['spells', 'Spells'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={t[key]}
                    onChange={(e) =>
                      setC({
                        ...c,
                        tomes: c.tomes!.map((v) =>
                          v.id === t.id ? { ...v, [key]: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Notes
                <textarea
                  value={t.notes}
                  onChange={(e) =>
                    setC({
                      ...c,
                      tomes: c.tomes!.map((v) =>
                        v.id === t.id ? { ...v, notes: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <button
                onClick={() =>
                  setC({ ...c, tomes: c.tomes!.filter((v) => v.id !== t.id) })
                }
              >
                <Trash2 /> Remove tome
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function CharacterEditor({
  character,
  campaignId,
  onSaved,
}: {
  character: Character;
  campaignId: string;
  onSaved: (c: Campaign) => void;
}) {
  const [draft, setDraft] = useState<Character>({
    ...character,
    backstory: character.backstory || emptyBackstory,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stats = [
    'str',
    'con',
    'siz',
    'dex',
    'app',
    'int',
    'pow',
    'edu',
    'luck',
  ] as const;
  const vitals = ['hp', 'sanity', 'mp', 'credit'] as const;
  async function save() {
    setBusy(true);
    setError('');
    try {
      const data = await api({
        action: 'saveCharacter',
        campaignId,
        character: draft,
      });
      onSaved(data.campaign);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update investigator.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="investigator-editor">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">AMEND DOSSIER</span>
          <h2>Edit investigator</h2>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save />
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
      <RulesReference age={draft.age} />
      <div className="edit-grid">
        <label>
          Name
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Occupation
          <input
            value={draft.occupation}
            onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
          />
        </label>
        <label>
          Age
          <input
            type="number"
            min="15"
            max="99"
            value={draft.age}
            onChange={(e) =>
              setDraft({ ...draft, age: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Residence
          <input
            value={draft.residence}
            onChange={(e) => setDraft({ ...draft, residence: e.target.value })}
          />
        </label>
      </div>
      <h3>Characteristics</h3>
      <div className="edit-stats">
        {stats.map((k) => (
          <label key={k}>
            {k.toUpperCase()}
            <input
              type="number"
              min="0"
              max="99"
              value={draft[k]}
              onChange={(e) =>
                setDraft({ ...draft, [k]: Number(e.target.value) })
              }
            />
            <small>
              Half {Math.floor(draft[k] / 2)} · Fifth {Math.floor(draft[k] / 5)}
            </small>
          </label>
        ))}
      </div>
      <button
        className="derive-button"
        onClick={() => setDraft(derived(draft))}
      >
        Recalculate derived values
      </button>
      <h3>Current resources</h3>
      <div className="edit-stats vitals-edit">
        {vitals.map((k) => (
          <label key={k}>
            {k === 'credit' ? 'Credit' : k.toUpperCase()}
            <input
              type="number"
              min="0"
              max="99"
              value={draft[k]}
              onChange={(e) =>
                setDraft({ ...draft, [k]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <OccupationPanel c={draft} setC={setDraft} />
      <h3>Skills</h3>
      <p className="skills-help">
        Enter each total skill value after spending occupation and
        personal-interest points.
      </p>
      <SkillEditor
        character={draft}
        onChange={(skills) => setDraft({ ...draft, skills })}
      />
      <CustomSkillsEditor c={draft} setC={setDraft} />
      <MechanicsEditor c={draft} setC={setDraft} />
      <div className="edit-long">
        <h3>Backstory</h3>
        {(
          [
            ['appearance', 'Personal description'],
            ['ideology', 'Ideology / beliefs'],
            ['significantPeople', 'Significant people'],
            ['meaningfulLocations', 'Meaningful locations'],
            ['treasuredPossessions', 'Treasured possessions'],
            ['traits', 'Traits'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              value={draft.backstory?.[key] || ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  backstory: {
                    ...(draft.backstory || emptyBackstory),
                    [key]: e.target.value,
                  },
                })
              }
            />
          </label>
        ))}
        <label>
          Sanity anchor / key connection
          <textarea
            value={draft.anchor}
            onChange={(e) => setDraft({ ...draft, anchor: e.target.value })}
          />
        </label>
        <label>
          Connection to another investigator
          <textarea
            value={draft.connection}
            onChange={(e) => setDraft({ ...draft, connection: e.target.value })}
          />
        </label>
        <label>
          Debt, secret, or past failure
          <textarea
            value={draft.secret}
            onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function RulesReference({ age }: { age: number }) {
  return (
    <details className="rules-reference">
      <summary>
        <BookOpen />
        <span>
          <b>Investigator creation rules</b>
          <small>Open the desk reference</small>
        </span>
        <ChevronDown />
      </summary>
      <div className="rules-grid">
        <article>
          <h3>Characteristics</h3>
          <p>
            Roll <b>3D6 × 5</b> for STR, CON, DEX, APP, and POW. Roll{' '}
            <b>(2D6 + 6) × 5</b> for SIZ, INT, and EDU. Luck is <b>3D6 × 5</b>.
          </p>
          <p>
            For any percentage, Hard difficulty is half the score and Extreme
            difficulty is one fifth, rounded down.
          </p>
        </article>
        <article>
          <h3>Derived values</h3>
          <p>
            <b>HP</b> = (CON + SIZ) ÷ 10, rounded down.
            <br />
            <b>SAN</b> begins equal to POW.
            <br />
            <b>MP</b> = one fifth of POW.
          </p>
          <p>
            MOV begins at 7, 8, or 9 by comparing STR and DEX with SIZ, then age
            may reduce it.
          </p>
        </article>
        <article>
          <h3>Age {age}</h3>
          <p>{ageGuidance(age)}</p>
          <p>
            An EDU improvement succeeds when D100 is greater than current EDU;
            add 1D10, to a maximum of 99.
          </p>
        </article>
        <article>
          <h3>Occupation and skills</h3>
          <p>
            Choose an occupation, then spend its formula’s occupational points
            only on listed occupation skills, including Credit Rating.
            Personal-interest points equal <b>INT × 2</b> and may go into any
            appropriate skills.
          </p>
        </article>
        <article>
          <h3>Backstory</h3>
          <p>
            Write three to six concise details across appearance, beliefs,
            significant people, meaningful places, treasured possessions, and
            traits. Mark one as the investigator’s key connection.
          </p>
        </article>
        <article>
          <h3>Finish the dossier</h3>
          <p>
            Record finances from Credit Rating, then choose important equipment
            appropriate to the occupation. Coordinate unusual possessions with
            the Keeper.
          </p>
        </article>
      </div>
    </details>
  );
}

function inlineMarkdown(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith('*') && part.endsWith('*') ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        part
      ),
    );
}
function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim())
    return <p className="notes-empty">Nothing has been written yet.</p>;
  return (
    <div className="markdown-preview">
      {value.split('\n').map((line, i) =>
        line.startsWith('## ') ? (
          <h3 key={i}>{inlineMarkdown(line.slice(3))}</h3>
        ) : line.startsWith('# ') ? (
          <h2 key={i}>{inlineMarkdown(line.slice(2))}</h2>
        ) : line.startsWith('- ') ? (
          <div className="md-list" key={i}>
            • {inlineMarkdown(line.slice(2))}
          </div>
        ) : line.startsWith('> ') ? (
          <blockquote key={i}>{inlineMarkdown(line.slice(2))}</blockquote>
        ) : line ? (
          <p key={i}>{inlineMarkdown(line)}</p>
        ) : (
          <br key={i} />
        ),
      )}
    </div>
  );
}
function NotesEditor({
  campaignId,
  initial,
  onSaved,
}: {
  campaignId: string;
  initial: string;
  onSaved: (c: Campaign) => void;
}) {
  const [notes, setNotes] = useState(initial);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setNotes(initial), [initial]);
  function format(before: string, after = before, placeholder = 'text') {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd,
      selected = notes.slice(start, end) || placeholder;
    setNotes(
      notes.slice(0, start) + before + selected + after + notes.slice(end),
    );
    setSaved(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const data = await api({ action: 'saveNotes', campaignId, notes });
      onSaved(data.campaign);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notes-editor">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">PRIVATE CASEBOOK</span>
          <h2>Investigator notes</h2>
          <p>Only you can read these notes. They are stored as Markdown.</p>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save />
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save notes'}
        </Button>
      </div>
      <div className="notes-tabs">
        <button
          className={mode === 'write' ? 'active' : ''}
          onClick={() => setMode('write')}
        >
          Write
        </button>
        <button
          className={mode === 'preview' ? 'active' : ''}
          onClick={() => setMode('preview')}
        >
          Preview
        </button>
      </div>
      {mode === 'write' ? (
        <>
          <div className="markdown-toolbar">
            <button
              title="Heading"
              onClick={() => format('## ', '', 'Heading')}
            >
              <Heading2 />
            </button>
            <button
              title="Bold"
              onClick={() => format('**', '**', 'bold text')}
            >
              <Bold />
            </button>
            <button
              title="Italic"
              onClick={() => format('*', '*', 'italic text')}
            >
              <Italic />
            </button>
            <button
              title="Bulleted list"
              onClick={() => format('- ', '', 'list item')}
            >
              <List />
            </button>
            <button
              title="Quote"
              onClick={() => format('> ', '', 'important detail')}
            >
              “
            </button>
          </div>
          <textarea
            ref={area}
            className="notes-textarea"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
            placeholder={
              '## Clues\n- The chauffeur lied about the time.\n\n## Suspicions\n**Ambrose** knows more than he admits.'
            }
          />
        </>
      ) : (
        <MarkdownPreview value={notes} />
      )}
      <footer>
        <span>{notes.length.toLocaleString()} / 50,000 characters</span>
        {saved && <b>Saved to your private casebook</b>}
      </footer>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function CharacterBuilder({
  session,
  campaign,
  onAccept,
  onLeave,
}: {
  session: Session;
  campaign: Campaign;
  onAccept: (d: { campaign: Campaign }) => void;
  onLeave: () => void;
}) {
  const [step, setStep] = useState(1);
  const existingDraft = campaign.players.find(
    (player) => player.id === session.playerId,
  )?.character;
  const [c, setC] = useState<Character>(() =>
    existingDraft
      ? {
          ...existingDraft,
          backstory: existingDraft.backstory || emptyBackstory,
        }
      : blankCharacter,
  );
  const [busy, setBusy] = useState<'draft' | 'finish' | null>(null);
  const [error, setError] = useState('');
  const [savedVersion, setSavedVersion] = useState(
    existingDraft ? JSON.stringify(existingDraft) : '',
  );
  const draftSaved = savedVersion === JSON.stringify(c);
  const stats = [
    'str',
    'con',
    'siz',
    'dex',
    'app',
    'int',
    'pow',
    'edu',
    'luck',
  ] as const;
  function randomize() {
    const next = { ...c };
    (['str', 'con', 'dex', 'app', 'pow'] as const).forEach(
      (k) => (next[k] = rollDice(3) * 5),
    );
    (['siz', 'int', 'edu'] as const).forEach(
      (k) => (next[k] = (rollDice(2) + 6) * 5),
    );
    next.luck = rollDice(3) * 5;
    setC(derived(next));
  }
  function update(next: Character) {
    setC(next);
  }
  async function saveDraft() {
    setBusy('draft');
    setError('');
    try {
      onAccept(
        await api({
          action: 'saveCharacterDraft',
          token: session.token,
          campaignId: campaign.id,
          character: c,
        }),
      );
      setSavedVersion(JSON.stringify(c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save draft.');
    } finally {
      setBusy(null);
    }
  }
  async function finish() {
    setBusy('finish');
    setError('');
    try {
      onAccept(
        await api({
          action: 'saveCharacter',
          token: session.token,
          campaignId: campaign.id,
          character: c,
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save investigator.',
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <main className="character-shell">
      <header>
        <div className="entry-brand">
          <Eye />
          <span>THE VEIL</span>
        </div>
        <div>
          <small>JOINING</small>
          <b>{campaign.name}</b>
        </div>
        <button onClick={onLeave}>Leave table</button>
      </header>
      <section className="character-paper">
        <div className="character-heading">
          <span>INVESTIGATOR DOSSIER · FORM 7-C</span>
          <h1>Create your investigator</h1>
          <p>
            Build someone with a reason to keep looking after the first
            impossible answer.
          </p>
          <small className="required-key">
            <i>*</i> Required before entering the table
          </small>
        </div>
        <RulesReference age={c.age} />
        <div className="stepper four-steps">
          {['Identity', 'Characteristics', 'Skills', 'Personal horror'].map(
            (label, i) => (
              <button
                key={label}
                className={
                  step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''
                }
                onClick={() => setStep(i + 1)}
              >
                <i>{step > i + 1 ? '✓' : i + 1}</i>
                <span>{label}</span>
              </button>
            ),
          )}
        </div>
        {step === 1 && (
          <div className="character-form">
            <div className="form-grid">
              <label>
                <span className="field-label">
                  Investigator name <i>*</i>
                </span>
                <input
                  autoFocus
                  required
                  value={c.name}
                  onChange={(e) => update({ ...c, name: e.target.value })}
                  placeholder="Evelyn Shaw"
                />
              </label>
              <label>
                <span className="field-label">
                  Occupation <i>*</i>
                </span>
                <input
                  required
                  value={c.occupation}
                  onChange={(e) => update({ ...c, occupation: e.target.value })}
                  placeholder="Investigative journalist"
                />
              </label>
              <label>
                Age
                <input
                  type="number"
                  min="15"
                  max="90"
                  value={c.age}
                  onChange={(e) => setC({ ...c, age: Number(e.target.value) })}
                />
              </label>
              <label>
                Residence
                <input
                  value={c.residence}
                  onChange={(e) => setC({ ...c, residence: e.target.value })}
                />
              </label>
            </div>
            <OccupationPanel c={c} setC={setC} />
            <div className="age-rule">
              <b>Age adjustment</b>
              <span>{ageGuidance(c.age)}</span>
            </div>
            <div className="prompt-card">
              <BookOpen />
              <span>
                <b>Why can’t you simply trust the police?</b>You can answer this
                in your personal horror details on the final page.
              </span>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="character-form">
            <div className="stats-head">
              <span>Core characteristics</span>
              <button onClick={randomize}>
                <Dices /> Roll a fresh set
              </button>
            </div>
            <div className="stat-grid">
              {stats.map((k) => (
                <label key={k}>
                  <span>{k}</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={c[k]}
                    onChange={(e) =>
                      setC({ ...c, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="derived">
              <span>
                HP <b>{c.hp}</b>
              </span>
              <span>
                Sanity <b>{c.sanity}</b>
              </span>
              <span>
                Magic <b>{c.mp}</b>
              </span>
              <label>
                Credit rating
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={c.credit}
                  onChange={(e) =>
                    setC({ ...c, credit: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="character-form skills-step">
            <div className="stats-head">
              <span>Investigator skills</span>
              <small>
                Enter final percentages after occupation and personal-interest
                points.
              </small>
            </div>
            <SkillEditor
              character={c}
              paper
              onChange={(skills) => setC({ ...c, skills })}
            />
            <CustomSkillsEditor c={c} setC={setC} />
          </div>
        )}
        {step === 4 && (
          <div className="character-form">
            <MechanicsEditor c={c} setC={setC} />
            {(
              [
                ['appearance', 'Personal description'],
                ['ideology', 'Ideology / beliefs'],
                ['significantPeople', 'Significant people'],
                ['meaningfulLocations', 'Meaningful locations'],
                ['treasuredPossessions', 'Treasured possessions'],
                ['traits', 'Traits'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  value={c.backstory?.[key] || ''}
                  onChange={(e) =>
                    setC({
                      ...c,
                      backstory: {
                        ...(c.backstory || emptyBackstory),
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
            <label>
              <span className="field-label">
                Sanity anchor / key connection <i>*</i>
              </span>
              <textarea
                required
                value={c.anchor}
                onChange={(e) => update({ ...c, anchor: e.target.value })}
                placeholder="A person, place, or principle that keeps you grounded…"
              />
            </label>
            <label>
              Connection to another investigator
              <textarea
                value={c.connection}
                onChange={(e) => setC({ ...c, connection: e.target.value })}
                placeholder="A debt, shared history, or reason to trust them…"
              />
            </label>
            <label>
              Debt, secret, or past failure
              <textarea
                value={c.secret}
                onChange={(e) => setC({ ...c, secret: e.target.value })}
                placeholder="Something that can complicate the case…"
              />
            </label>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="character-actions">
          <button disabled={step === 1} onClick={() => setStep(step - 1)}>
            Back
          </button>
          <div className="character-save-actions">
            <span aria-live="polite">
              {draftSaved ? 'Draft saved to your account' : 'Unsaved changes'}
            </span>
            <button
              type="button"
              className="save-draft"
              onClick={saveDraft}
              disabled={Boolean(busy)}
            >
              <Save /> {busy === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  step === 1 && (!c.name.trim() || !c.occupation.trim())
                }
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={finish}
                disabled={
                  Boolean(busy) ||
                  !c.name.trim() ||
                  !c.occupation.trim() ||
                  !c.anchor.trim()
                }
              >
                {busy === 'finish' ? 'Filing dossier…' : 'Enter the table'}
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Table({
  session,
  campaign,
  onCampaign,
  onLeave,
}: {
  session: Session;
  campaign: Campaign;
  onCampaign: (c: Campaign) => void;
  onLeave: () => void;
}) {
  const keeper = session.role === 'keeper';
  const me = campaign.players.find((p) => p.id === session.playerId);
  const [activeTool, setActiveTool] = useState(0);
  const [zoom, setZoom] = useState(82);
  const [tab, setTab] = useState<'roster' | 'story' | 'sheet' | 'log'>(
    keeper ? 'roster' : 'sheet',
  );
  const [modal, setModal] = useState<'scene' | 'npc' | 'maps' | null>(null);
  const [modalForm, setModalForm] = useState({
    title: '',
    description: '',
    name: '',
    kind: 'npc',
  });
  const [message, setMessage] = useState('');
  const [handoutDraft, setHandoutDraft] = useState({
    title: '',
    body: '',
    revealed: true,
  });
  const [whisper, setWhisper] = useState({ playerId: '', message: '' });
  const [rolling, setRolling] = useState(false);
  const [diceModifier, setDiceModifier] = useState(0);
  const [opponentId, setOpponentId] = useState('');
  const [opposedSkill, setOpposedSkill] = useState('fightingBrawl');
  const [dice, setDice] = useState({ label: 'D100', value: '—' });
  const [rollReveal, setRollReveal] = useState<{
    check: string;
    total: number;
    outcome: string;
  } | null>(null);
  const revealTimer = useRef<number | null>(null);
  const [lastCheck, setLastCheck] = useState<{
    check: string;
    target: number;
    rolled: number;
    outcome: string;
    skillKey?: string;
    pushed?: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    type: 'player' | 'piece';
    last: { x: number; y: number };
  } | null>(null);
  const [tokenPositions, setTokenPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selected, setSelected] = useState<string[]>([]);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
  const [stroke, setStroke] = useState<{ x: number; y: number }[]>([]);
  const [marquee, setMarquee] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const [replaceMapId, setReplaceMapId] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const mapInput = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const currentMap = campaign.maps?.find((m) => m.isCurrent);
  const runtime = {
    combat: campaign.runtime?.combat || {
      active: false,
      round: 1,
      turnIndex: 0,
      order: [],
    },
    handouts: campaign.runtime?.handouts || [],
  };
  const privateInbox = campaign.privateMessages || [];
  useEffect(() => {
    if (tab !== 'log') return;
    const frame = requestAnimationFrame(() =>
      logRef.current?.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: 'smooth',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [tab, campaign.events.length]);
  const tokens = useMemo(
    () => [
      ...campaign.players
        .filter((p) => p.onBoard && p.character)
        .map((p) => ({
          id: p.id,
          type: 'player' as const,
          name: p.character!.name,
          initials: p
            .character!.name.split(/\s+/)
            .map((v) => v[0])
            .join('')
            .slice(0, 2),
          x: p.x,
          y: p.y,
          kind: 'player',
          image: p.tokenUrl || tokenArt[p.character!.name],
        })),
      ...campaign.pieces
        .filter((p) => keeper || !p.hidden)
        .map((p) => ({
          id: p.id,
          type: 'piece' as const,
          name: p.name,
          initials: p.initials,
          x: p.x,
          y: p.y,
          kind: p.kind,
          image: tokenArt[p.name],
        })),
    ],
    [campaign, keeper],
  );
  useEffect(() => {
    if (dragging) return;
    setTokenPositions(
      Object.fromEntries(
        tokens.map((t) => [`${t.type}:${t.id}`, { x: t.x, y: t.y }]),
      ),
    );
  }, [tokens, dragging]);
  async function act(body: Record<string, unknown>) {
    try {
      const data = await api({
        ...body,
        token: session.token,
        campaignId: campaign.id,
      });
      if (data.campaign) onCampaign(data.campaign);
      return data;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Action failed.');
    }
  }
  async function roll(
    sides = 100,
    check = `D${sides} roll`,
    target?: number,
    skillKey?: string,
    pushed = false,
  ) {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    setRollReveal(null);
    setRolling(true);
    const data = await act({
      action: 'roll',
      sides,
      count: 1,
      check,
      target,
      skillKey,
      pushed,
      bonusPenalty: sides === 100 ? diceModifier : 0,
    });
    window.setTimeout(() => {
      if (data?.rolls) {
        setDice({ label: `D${sides}`, value: String(data.rolls[0]) });
        setRollReveal({
          check,
          total: data.total ?? data.rolls[0],
          outcome: data.outcome || 'Roll complete',
        });
        if (sides === 100 && target)
          setLastCheck({
            check,
            target,
            rolled: data.rolls[0],
            outcome: data.outcome || '',
            skillKey,
            pushed,
          });
        revealTimer.current = window.setTimeout(
          () => setRollReveal(null),
          3200,
        );
      }
      setRolling(false);
    }, 650);
  }
  async function spendLuck() {
    if (!lastCheck || !me?.character) return;
    const amount = lastCheck.rolled - lastCheck.target;
    if (amount <= 0 || amount > me.character.luck) return;
    await act({
      action: 'spendLuck',
      amount,
      check: lastCheck.check,
      rolled: lastCheck.rolled,
      target: lastCheck.target,
    });
    setLastCheck({
      ...lastCheck,
      rolled: lastCheck.target,
      outcome: 'Success',
    });
  }
  async function damageRoll(weapon: CharacterWeapon) {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    setRollReveal(null);
    setRolling(true);
    const check = `${weapon.name} damage`,
      data = await act({
        action: 'rollFormula',
        formula: weapon.damage,
        check,
      });
    window.setTimeout(() => {
      if (data?.total !== undefined) {
        setDice({
          label: weapon.damage.toUpperCase(),
          value: String(data.total),
        });
        setRollReveal({ check, total: data.total, outcome: 'Damage' });
        revealTimer.current = window.setTimeout(
          () => setRollReveal(null),
          3200,
        );
      }
      setRolling(false);
    }, 650);
  }
  async function attackWeapon(weapon: CharacterWeapon) {
    const value =
        allSkills(me!.character!).find((s) => s.key === weapon.skillKey)
          ?.value || 0,
      modifier = (me!.character!.modifiers || [])
        .filter((m) => m.target === 'all' || m.target === weapon.skillKey)
        .reduce((n, m) => n + m.amount, 0);
    setRolling(true);
    const data = await act({
      action: 'weaponAttack',
      weaponId: weapon.id,
      target: Math.max(1, Math.min(99, value + modifier)),
      bonusPenalty: diceModifier,
    });
    window.setTimeout(() => {
      if (data?.roll !== undefined) {
        setDice({ label: 'D100', value: String(data.roll) });
        setRollReveal({
          check: `${weapon.name} attack`,
          total: data.roll,
          outcome: data.outcome,
        });
        revealTimer.current = window.setTimeout(
          () => setRollReveal(null),
          3200,
        );
      }
      setRolling(false);
    }, 650);
  }
  async function castSpell(spellId: string) {
    const data = await act({ action: 'castSpell', spellId });
    if (data) setNotice(data.message);
  }
  async function opposedRoll() {
    const opponent = campaign.players.find(
      (p) => p.id === opponentId,
    )?.character;
    if (!opponent || !me?.character) return;
    const mine = allSkills(me.character).find((s) => s.key === opposedSkill),
      theirs = allSkills(opponent).find((s) => s.key === opposedSkill);
    const data = await act({
      action: 'opposedRoll',
      opponentId,
      skillKey: opposedSkill,
      skillName: mine?.label || 'Opposed check',
      challengerTarget: mine?.value || 0,
      opponentTarget: theirs?.value || 0,
    });
    if (data)
      setNotice(
        `${data.challengerRoll} vs ${data.opponentRoll} — ${data.winner}`,
      );
  }
  async function submitModal() {
    if (modal === 'scene')
      await act({
        action: 'setScene',
        title: modalForm.title,
        description: modalForm.description,
      });
    else
      await act({
        action: 'addNpc',
        name: modalForm.name,
        kind: modalForm.kind,
      });
    setModal(null);
    setModalForm({ title: '', description: '', name: '', kind: 'npc' });
  }
  async function send() {
    if (!message.trim()) return;
    await act({ action: 'message', message });
    setMessage('');
  }
  async function uploadMap(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setNotice('Choose a PNG, JPG, or WebP image smaller than 10 MB.');
      return;
    }
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('The selected map could not be read.'));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await act({
      action: replaceMapId ? 'replaceMap' : 'uploadMap',
      mapId: replaceMapId,
      name: file.name.replace(/\.[^.]+$/, ''),
      image,
    });
    setReplaceMapId('');
    if (mapInput.current) mapInput.current.value = '';
  }
  function point(e: React.PointerEvent<HTMLElement>) {
    const b =
      boardRef.current?.getBoundingClientRect() ||
      e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - b.top) / b.height) * 100)),
    };
  }
  const tokenKey = (type: 'player' | 'piece', id: string) => `${type}:${id}`;
  const canMove = (type: 'player' | 'piece', id: string) =>
    keeper || (type === 'player' && id === session.playerId);
  function boardDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const p = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (activeTool === 0) {
      setMarquee({ start: p, end: p });
      if (!e.shiftKey) setSelected([]);
      return;
    }
    if (!keeper || ![2, 3, 4, 5, 6, 7].includes(activeTool)) return;
    if (activeTool === 6) {
      void act({
        action: 'addMark',
        kind: 'sticker',
        data: { ...p, label: '✦' },
      });
      return;
    }
    setDrawStart(p);
    setDrawEnd(p);
    setStroke(activeTool === 2 ? [p] : []);
  }
  function boardMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = point(e);
    if (marquee) {
      setMarquee({ ...marquee, end: p });
      return;
    }
    if (drawStart) {
      setDrawEnd(p);
      if (activeTool === 2)
        setStroke((points) => {
          const last = points[points.length - 1];
          return !last || Math.hypot(p.x - last.x, p.y - last.y) > 0.18
            ? [...points, p]
            : points;
        });
      return;
    }
    if (!dragging) return;
    const dx = p.x - dragging.last.x,
      dy = p.y - dragging.last.y,
      key = tokenKey(dragging.type, dragging.id),
      moving = selected.includes(key) ? selected : [key];
    setTokenPositions((current) => {
      const next = { ...current };
      for (const movingKey of moving) {
        const fallback = tokens.find(
            (t) => tokenKey(t.type, t.id) === movingKey,
          ),
          position =
            next[movingKey] ||
            (fallback ? { x: fallback.x, y: fallback.y } : null);
        if (position)
          next[movingKey] = {
            x: Math.max(3, Math.min(97, position.x + dx)),
            y: Math.max(5, Math.min(95, position.y + dy)),
          };
      }
      return next;
    });
    setDragging({ ...dragging, last: p });
  }
  async function boardUp(e: React.PointerEvent<HTMLDivElement>) {
    if (marquee) {
      const x1 = Math.min(marquee.start.x, marquee.end.x),
        x2 = Math.max(marquee.start.x, marquee.end.x),
        y1 = Math.min(marquee.start.y, marquee.end.y),
        y2 = Math.max(marquee.start.y, marquee.end.y),
        inside = tokens
          .filter(
            (t) =>
              canMove(t.type, t.id) &&
              t.x >= x1 &&
              t.x <= x2 &&
              t.y >= y1 &&
              t.y <= y2,
          )
          .map((t) => tokenKey(t.type, t.id));
      setSelected(
        e.shiftKey ? Array.from(new Set([...selected, ...inside])) : inside,
      );
      setMarquee(null);
      return;
    }
    if (dragging) {
      await drop();
      return;
    }
    if (!drawStart) return;
    const end = drawEnd || point(e),
      kind =
        activeTool === 2
          ? 'freehand'
          : activeTool === 3
            ? 'ruler'
            : activeTool === 4
              ? 'rect'
              : activeTool === 7
                ? 'fog'
                : 'circle',
      data =
        kind === 'freehand'
          ? {
              ...drawStart,
              points: stroke.length > 1 ? stroke : [drawStart, end],
              color: '#d7c28f',
            }
          : {
              ...drawStart,
              x2: end.x,
              y2: end.y,
              color:
                kind === 'circle' || kind === 'rect' ? '#b98f4c' : '#d7c28f',
              label:
                kind === 'ruler'
                  ? `${Math.round(Math.hypot(end.x - drawStart.x, end.y - drawStart.y))} units`
                  : undefined,
            };
    setDrawStart(null);
    setDrawEnd(null);
    setStroke([]);
    await act({ action: 'addMark', kind, data });
  }
  function tokenDown(
    e: React.PointerEvent<HTMLButtonElement>,
    type: 'player' | 'piece',
    id: string,
  ) {
    if (activeTool !== 0 || !canMove(type, id)) return;
    e.stopPropagation();
    const p = point(e),
      key = tokenKey(type, id);
    if (e.shiftKey) {
      setSelected((values) =>
        values.includes(key)
          ? values.filter((v) => v !== key)
          : [...values, key],
      );
      return;
    }
    if (!selected.includes(key)) setSelected([key]);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ id, type, last: p });
  }
  async function drop() {
    if (!dragging) return;
    const key = tokenKey(dragging.type, dragging.id),
      moving = selected.includes(key) ? selected : [key],
      moves = tokens
        .filter((t) => moving.includes(tokenKey(t.type, t.id)))
        .map((t) => {
          const position = tokenPositions[tokenKey(t.type, t.id)] || t;
          return {
            targetId: t.id,
            targetType: t.type,
            x: position.x,
            y: position.y,
          };
        });
    onCampaign({
      ...campaign,
      players: campaign.players.map((p) => {
        const pos = tokenPositions[tokenKey('player', p.id)];
        return pos ? { ...p, ...pos } : p;
      }),
      pieces: campaign.pieces.map((p) => {
        const pos = tokenPositions[tokenKey('piece', p.id)];
        return pos ? { ...p, ...pos } : p;
      }),
    });
    setDragging(null);
    if (moves.length) await act({ action: 'moveMany', moves });
  }
  const previewMark: BoardMark | null =
    drawStart && drawEnd
      ? {
          id: 'preview',
          kind:
            activeTool === 2
              ? 'freehand'
              : activeTool === 3
                ? 'ruler'
                : activeTool === 4
                  ? 'rect'
                  : activeTool === 7
                    ? 'fog'
                    : 'circle',
          hidden: false,
          data:
            activeTool === 2
              ? { ...drawStart, points: stroke, color: '#d7c28f' }
              : {
                  ...drawStart,
                  x2: drawEnd.x,
                  y2: drawEnd.y,
                  color:
                    activeTool === 4 || activeTool === 5
                      ? '#b98f4c'
                      : '#d7c28f',
                  label:
                    activeTool === 3
                      ? `${Math.round(Math.hypot(drawEnd.x - drawStart.x, drawEnd.y - drawStart.y))} units`
                      : undefined,
                },
        }
      : null;
  const marqueeStyle = marquee
    ? {
        left: `${Math.min(marquee.start.x, marquee.end.x)}%`,
        top: `${Math.min(marquee.start.y, marquee.end.y)}%`,
        width: `${Math.abs(marquee.end.x - marquee.start.x)}%`,
        height: `${Math.abs(marquee.end.y - marquee.start.y)}%`,
      }
    : undefined;
  return (
    <main className="vtt-shell">
      <header className="topbar">
        <div className="brand-mark">
          <Eye size={19} />
          <span>THE VEIL</span>
          <small>
            {campaign.location.toUpperCase()} · {campaign.year}
          </small>
        </div>
        <button className="case-title">
          {campaign.name.toUpperCase()} <ChevronDown size={14} />
        </button>
        <div className="session-meta">
          <span
            className={campaign.status === 'live' ? 'live-dot' : 'idle-dot'}
          />{' '}
          {campaign.status === 'live'
            ? `SESSION ${campaign.sessionNumber} LIVE`
            : 'TABLE CLOSED'}
        </div>
        <div className="header-actions">
          {keeper && (
            <button
              className="join-code"
              onClick={() => {
                void navigator.clipboard.writeText(campaign.joinCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              <KeyRound />
              {copied ? 'COPIED' : campaign.joinCode}
              <Copy />
            </button>
          )}
          <button className="role-switch" onClick={onLeave}>
            {keeper ? <ShieldAlert /> : <Users />}
            {keeper ? 'Keeper' : 'Player'} · Exit
          </button>
        </div>
      </header>
      <aside className="rail">
        <nav>
          <button className="active">
            <Map />
            <span>Table</span>
          </button>
          {keeper && (
            <button onClick={() => setTab('roster')}>
              <Users />
              <span>Party</span>
            </button>
          )}
          <button onClick={() => setTab('story')}>
            <Waypoints />
            <span>Story</span>
          </button>
          {!keeper && (
            <button onClick={() => setTab('sheet')}>
              <BookOpen />
              <span>Sheet</span>
            </button>
          )}
          <button onClick={() => setTab('log')}>
            <ScrollText />
            <span>Log</span>
          </button>
          {keeper && (
            <button onClick={() => setModal('npc')}>
              <UserRoundPlus />
              <span>Add NPC</span>
            </button>
          )}
        </nav>
        <button className="rail-bottom" onClick={onLeave}>
          <DoorOpen />
          <span>Exit</span>
        </button>
      </aside>
      <section className="workspace">
        <div className="board-head">
          <div>
            <span className="eyebrow">CURRENT SCENE</span>
            <h1>{campaign.sceneTitle}</h1>
            <p>{campaign.sceneDescription}</p>
          </div>
          <div className="map-actions">
            {keeper && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal('maps')}
              >
                <Map /> Manage maps
              </Button>
            )}
            {keeper && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal('npc')}
              >
                <Users /> Add piece
              </Button>
            )}
            {keeper && (
              <Button size="sm" onClick={() => setModal('scene')}>
                <Sparkles /> Set scene
              </Button>
            )}
          </div>
        </div>
        <div className="board-wrap">
          <div className="tool-dock">
            {mapTools.map((Icon, i) => (
              <button
                key={i}
                className={activeTool === i ? 'active' : ''}
                onClick={() => {
                  setActiveTool(i);
                  setSelected([]);
                  setMarquee(null);
                  setDrawStart(null);
                }}
                aria-label={
                  [
                    'Select tokens',
                    'Pan map',
                    'Freehand draw',
                    'Measure distance',
                    'Draw rectangle',
                    'Draw circle',
                    'Place sticker',
                    'Add fog',
                  ][i]
                }
                title={
                  [
                    'Select tokens',
                    'Pan map',
                    'Freehand draw',
                    'Measure distance',
                    'Draw rectangle',
                    'Draw circle',
                    'Place sticker',
                    'Add fog',
                  ][i]
                }
              >
                <Icon />
              </button>
            ))}
            {keeper && campaign.marks?.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Clear every drawing and sticker?'))
                    void act({ action: 'clearMarks' });
                }}
                title="Clear drawings"
              >
                <Trash2 />
              </button>
            )}
          </div>
          <div
            ref={boardRef}
            className={`game-board ${tokens.length ? '' : 'empty-board'} tool-${activeTool}`}
            style={
              currentMap
                ? {
                    backgroundImage: `linear-gradient(#07100da8,#07100da8),url("${currentMap.url}")`,
                  }
                : undefined
            }
            onPointerDown={boardDown}
            onPointerMove={boardMove}
            onPointerUp={boardUp}
          >
            <svg
              className="board-marks"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {campaign.marks
                ?.filter((mark) => mark.kind !== 'sticker')
                .map((mark) => (
                  <BoardMarkShape key={mark.id} mark={mark} />
                ))}
              {previewMark && <BoardMarkShape mark={previewMark} />}
            </svg>
            {campaign.marks
              ?.filter((m) => m.kind === 'sticker')
              .map((mark) => (
                <span
                  className="board-sticker"
                  key={mark.id}
                  style={{ left: `${mark.data.x}%`, top: `${mark.data.y}%` }}
                >
                  {mark.data.label || '✦'}
                </span>
              ))}
            {marquee && (
              <div className="selection-marquee" style={marqueeStyle} />
            )}
            <div className="fog fog-a" />
            <div className="fog fog-b" />
            {tokens.length === 0 && (
              <div className="board-empty">
                <Map />
                <h2>
                  {currentMap ? 'No tokens on this map' : 'The table is empty'}
                </h2>
                <p>
                  {keeper
                    ? 'Choose players from the roster or add an NPC or threat.'
                    : 'Your Keeper is preparing the scene.'}
                </p>
              </div>
            )}
            {tokens.map((t) => {
              const key = tokenKey(t.type, t.id);
              const position = tokenPositions[key] || t;
              return (
                <button
                  key={key}
                  className={`token ${t.kind} ${t.image ? 'has-art' : ''} ${selected.includes(key) ? 'selected' : ''}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  onPointerDown={(e) => tokenDown(e, t.type, t.id)}
                >
                  <span>
                    {t.image ? (
                      <img src={t.image} alt="" draggable={false} />
                    ) : (
                      t.initials
                    )}
                  </span>
                  <em>{t.name}</em>
                </button>
              );
            })}
            {(rolling || rollReveal) && (
              <div
                className={`dice-stage ${rollReveal ? 'settled' : 'rolling'}`}
                aria-live="assertive"
              >
                <div className="dice-cast" aria-hidden="true">
                  <b>{rollReveal ? Math.floor(rollReveal.total / 10) : '0'}</b>
                  <b>{rollReveal ? rollReveal.total % 10 : '10'}</b>
                  <b>{rollReveal ? rollReveal.total : '00'}</b>
                </div>
                {rollReveal && (
                  <div
                    className={`roll-result ${rollReveal.outcome.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <small>{rollReveal.check}</small>
                    <strong>{rollReveal.total}</strong>
                    <span>{rollReveal.outcome}</span>
                  </div>
                )}
              </div>
            )}
            {notice && (
              <div className="notice">
                <Sparkles />
                <span>{notice}</span>
                <button onClick={() => setNotice('')}>×</button>
              </div>
            )}
            {keeper && selected.length > 0 && (
              <div className="selection-inspector">
                <b>{selected.length} selected</b>
                <button
                  onClick={() => {
                    for (const key of selected) {
                      const [type, id] = key.split(':');
                      void act(
                        type === 'piece'
                          ? { action: 'togglePieceHidden', pieceId: id }
                          : { action: 'togglePlayerBoard', playerId: id },
                      );
                    }
                    setSelected([]);
                  }}
                >
                  {selected.some((k) => k.startsWith('piece:'))
                    ? 'Toggle visibility'
                    : 'Remove from map'}
                </button>
                <button
                  onClick={() => {
                    for (const key of selected) {
                      const [type, id] = key.split(':');
                      void act({
                        action: 'adjustStat',
                        targetType: type,
                        targetId: id,
                        stat: 'hp',
                        delta: -1,
                      });
                    }
                  }}
                >
                  −1 HP
                </button>
                <button
                  onClick={() => {
                    for (const key of selected) {
                      const [type, id] = key.split(':');
                      void act({
                        action: 'adjustStat',
                        targetType: type,
                        targetId: id,
                        stat: 'hp',
                        delta: 1,
                      });
                    }
                  }}
                >
                  +1 HP
                </button>
                <button onClick={() => setSelected([])}>Clear</button>
              </div>
            )}
            <div className="board-status">
              <Eye /> {currentMap?.name?.toUpperCase() || 'SHARED TABLE'}{' '}
              <span>{campaign.status.toUpperCase()}</span>
            </div>
          </div>
          <div className="zoom-control">
            <button onClick={() => setZoom(Math.max(40, zoom - 10))}>
              <Minus />
            </button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom(Math.min(150, zoom + 10))}>
              <Plus />
            </button>
            <button>
              <Maximize2 />
            </button>
          </div>
        </div>
        <div className="bottom-dock">
          <div className="dice-copy">
            <Dices />
            <div>
              <b>Dice tray</b>
              <span>{keeper ? 'Public by default' : 'Always public'}</span>
            </div>
          </div>
          <div className="dice-values">
            <button
              className={rolling ? 'rolling' : ''}
              onClick={() =>
                roll(Number(dice.label.slice(1)) || 100, `${dice.label} roll`)
              }
            >
              <small>{dice.label}</small>
              <b>{dice.value}</b>
            </button>
          </div>
          <div className="dice-kinds">
            {[4, 6, 8, 10, 12, 20, 100].map((d) => (
              <button key={d} onClick={() => roll(d, `D${d} roll`)}>
                D{d}
              </button>
            ))}
          </div>
          <Button
            className="roll-button"
            onClick={() => roll(100, 'D100 roll')}
            disabled={rolling}
          >
            {rolling ? 'Rolling…' : 'Roll D100'}
          </Button>
          {keeper && (
            <Button
              variant="outline"
              onClick={async () => {
                const data = await act({ action: 'unreality' });
                if (data) setNotice(`${data.roll}. ${data.result}`);
              }}
            >
              <Eye /> Unreality
            </Button>
          )}
        </div>
      </section>
      <aside className="right-panel">
        <div className={`panel-tabs ${keeper ? 'keeper-tabs' : 'player-tabs'}`}>
          {keeper && (
            <button
              className={tab === 'roster' ? 'active' : ''}
              onClick={() => setTab('roster')}
            >
              Roster
            </button>
          )}
          <button
            className={tab === 'story' ? 'active' : ''}
            onClick={() => setTab('story')}
          >
            Story
          </button>
          {!keeper && (
            <button
              className={tab === 'sheet' ? 'active' : ''}
              onClick={() => setTab('sheet')}
            >
              My sheet
            </button>
          )}
          <button
            className={tab === 'log' ? 'active' : ''}
            onClick={() => setTab('log')}
          >
            Log
          </button>
          {keeper && (
            <button
              className={campaign.status === 'live' ? 'live-action' : ''}
              onClick={() => act({ action: 'startSession' })}
            >
              {campaign.status === 'live' ? 'Pause' : 'Go live'}
            </button>
          )}
        </div>
        {tab === 'roster' && (
          <section className="party-section">
            {keeper && (
              <div className="combat-console">
                <div className="section-title">
                  <span>ENCOUNTER TRACKER</span>
                  <b>
                    {runtime.combat.active
                      ? `ROUND ${runtime.combat.round}`
                      : 'INACTIVE'}
                  </b>
                </div>
                {runtime.combat.active ? (
                  <>
                    <div className="initiative-list">
                      {runtime.combat.order.map((entry, i) => (
                        <div
                          className={
                            i === runtime.combat.turnIndex ? 'active' : ''
                          }
                          key={`${entry.type}:${entry.id}`}
                        >
                          <span>
                            {i === runtime.combat.turnIndex ? '▶' : '·'}
                          </span>
                          <b>{entry.name}</b>
                          <input
                            type="number"
                            value={entry.initiative}
                            onChange={(e) =>
                              void act({
                                action: 'setInitiative',
                                entryId: entry.id,
                                initiative: Number(e.target.value),
                              })
                            }
                          />
                          <small>
                            {entry.hp === null
                              ? '—'
                              : `${entry.hp}/${entry.maxHp} HP`}
                          </small>
                        </div>
                      ))}
                    </div>
                    <div className="combat-actions">
                      <button
                        onClick={() => void act({ action: 'advanceCombat' })}
                      >
                        Next turn
                      </button>
                      <button onClick={() => void act({ action: 'endCombat' })}>
                        End encounter
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="start-combat"
                    onClick={() => void act({ action: 'startCombat' })}
                  >
                    <Swords /> Begin encounter
                  </button>
                )}
              </div>
            )}
            <div className="section-title">
              <span>INVESTIGATORS · {campaign.players.length}</span>
              {keeper && (
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(campaign.joinCode);
                  }}
                >
                  <Copy />
                </button>
              )}
            </div>
            {campaign.players.length === 0 ? (
              <div className="panel-empty">
                <Users />
                <b>No players yet</b>
                <p>
                  Share code <strong>{campaign.joinCode}</strong> to invite
                  them.
                </p>
              </div>
            ) : (
              campaign.players.map((p) => (
                <div className="party-row managed" key={p.id}>
                  <span className="mini-token player">
                    {p.character &&
                    (p.tokenUrl || tokenArt[p.character.name]) ? (
                      <img
                        src={p.tokenUrl || tokenArt[p.character.name]}
                        alt=""
                      />
                    ) : p.character ? (
                      p.character.name
                        .split(/\s+/)
                        .map((v) => v[0])
                        .join('')
                        .slice(0, 2)
                    ) : (
                      '…'
                    )}
                  </span>
                  <div>
                    <b>{p.character?.name || p.name}</b>
                    <small>
                      {p.character?.occupation || 'Creating investigator'}
                    </small>
                    {p.character && (
                      <span className="quick-vitals">
                        <button
                          onClick={() =>
                            void act({
                              action: 'adjustStat',
                              targetType: 'player',
                              targetId: p.id,
                              stat: 'hp',
                              delta: -1,
                            })
                          }
                        >
                          −
                        </button>
                        <em>{p.character.hp} HP</em>
                        <button
                          onClick={() =>
                            void act({
                              action: 'adjustStat',
                              targetType: 'player',
                              targetId: p.id,
                              stat: 'hp',
                              delta: 1,
                            })
                          }
                        >
                          +
                        </button>
                      </span>
                    )}
                  </div>
                  {keeper && p.character && (
                    <button
                      className={p.onBoard ? 'map-toggle on' : 'map-toggle'}
                      onClick={() =>
                        void act({
                          action: 'togglePlayerBoard',
                          playerId: p.id,
                        })
                      }
                    >
                      {p.onBoard ? 'Remove' : 'Add'}
                    </button>
                  )}
                </div>
              ))
            )}
            {keeper && (
              <>
                <div className="section-title cast-title">
                  <span>NPCs & THREATS · {campaign.pieces.length}</span>
                  <button onClick={() => setModal('npc')}>
                    <Plus />
                  </button>
                </div>
                {campaign.pieces.map((p) => (
                  <div className="party-row managed" key={p.id}>
                    <span className={`mini-token ${p.kind}`}>{p.initials}</span>
                    <div>
                      <b>{p.name}</b>
                      <small>
                        {p.hidden
                          ? 'Hidden from players'
                          : p.kind === 'mob'
                            ? 'Visible threat'
                            : 'Visible NPC'}
                      </small>
                      <span className="quick-vitals">
                        <button
                          onClick={() =>
                            void act({
                              action: 'adjustStat',
                              targetType: 'piece',
                              targetId: p.id,
                              stat: 'hp',
                              delta: -1,
                            })
                          }
                        >
                          −
                        </button>
                        <em>{p.hp ?? '—'} HP</em>
                        <button
                          onClick={() =>
                            void act({
                              action: 'adjustStat',
                              targetType: 'piece',
                              targetId: p.id,
                              stat: 'hp',
                              delta: 1,
                            })
                          }
                        >
                          +
                        </button>
                      </span>
                    </div>
                    <button
                      className={p.hidden ? 'map-toggle' : 'map-toggle on'}
                      onClick={() =>
                        void act({ action: 'togglePieceHidden', pieceId: p.id })
                      }
                    >
                      {p.hidden ? 'Reveal' : 'Hide'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>
        )}
        {tab === 'story' && (
          <section className="story-panel">
            <div className="section-title">
              <span>CAMPAIGN STATUS</span>
            </div>
            <h3>
              {campaign.status === 'live'
                ? `Session ${campaign.sessionNumber} in progress`
                : 'Waiting in the lobby'}
            </h3>
            <p>{campaign.sceneDescription}</p>
            <h3>Campaign promise</h3>
            <p>
              Compromised people search for truth in a city built to bury it.
              Every answer creates a more dangerous question.
            </p>
            {keeper && (
              <Button onClick={() => setModal('scene')}>
                Set current scene
              </Button>
            )}
            <div className="handout-panel">
              <h3>Player handouts</h3>
              {keeper && (
                <div className="handout-compose">
                  <input
                    value={handoutDraft.title}
                    onChange={(e) =>
                      setHandoutDraft({
                        ...handoutDraft,
                        title: e.target.value,
                      })
                    }
                    placeholder="Handout title"
                  />
                  <textarea
                    value={handoutDraft.body}
                    onChange={(e) =>
                      setHandoutDraft({ ...handoutDraft, body: e.target.value })
                    }
                    placeholder="Letter, clue, newspaper clipping, vision…"
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={handoutDraft.revealed}
                      onChange={(e) =>
                        setHandoutDraft({
                          ...handoutDraft,
                          revealed: e.target.checked,
                        })
                      }
                    />{' '}
                    Reveal immediately
                  </label>
                  <button
                    onClick={async () => {
                      const data = await act({
                        action: 'saveHandout',
                        ...handoutDraft,
                      });
                      if (data)
                        setHandoutDraft({
                          title: '',
                          body: '',
                          revealed: true,
                        });
                    }}
                  >
                    Create handout
                  </button>
                </div>
              )}
              {(runtime.handouts || []).map((h) => (
                <article key={h.id} className={h.revealed ? 'revealed' : ''}>
                  <header>
                    <b>{h.title}</b>
                    {keeper && (
                      <span>
                        <button
                          onClick={() =>
                            void act({
                              action: 'toggleHandout',
                              handoutId: h.id,
                            })
                          }
                        >
                          {h.revealed ? 'Hide' : 'Reveal'}
                        </button>
                        <button
                          onClick={() =>
                            void act({
                              action: 'deleteHandout',
                              handoutId: h.id,
                            })
                          }
                        >
                          <Trash2 />
                        </button>
                      </span>
                    )}
                  </header>
                  <p>{h.body}</p>
                </article>
              ))}
            </div>
            {keeper && (
              <div className="whisper-panel">
                <h3>Private message</h3>
                <select
                  value={whisper.playerId}
                  onChange={(e) =>
                    setWhisper({ ...whisper, playerId: e.target.value })
                  }
                >
                  <option value="">Choose player…</option>
                  {campaign.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.character?.name || p.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={whisper.message}
                  onChange={(e) =>
                    setWhisper({ ...whisper, message: e.target.value })
                  }
                  placeholder="Only this player will see this…"
                />
                <button
                  disabled={!whisper.playerId || !whisper.message.trim()}
                  onClick={async () => {
                    const data = await act({
                      action: 'privateMessage',
                      ...whisper,
                    });
                    if (data) {
                      setWhisper({ playerId: '', message: '' });
                      setNotice('Private message sent.');
                    }
                  }}
                >
                  Send privately
                </button>
              </div>
            )}
            {!keeper && privateInbox.length > 0 && (
              <div className="private-inbox">
                <h3>Messages from the Keeper</h3>
                {privateInbox.map((m) => (
                  <article key={m.id}>
                    <b>{m.sender}</b>
                    <p>{m.message}</p>
                    <small>{new Date(m.createdAt).toLocaleTimeString()}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === 'sheet' && me?.character && (
          <section className="quick-sheet">
            <CharacterSheet character={me.character} showSkills={false} />
            <div className="quick-actions">
              <span>CHARACTERISTIC CHECKS</span>
              {(
                ['str', 'con', 'dex', 'int', 'pow', 'luck', 'sanity'] as const
              ).map((stat) => (
                <button
                  key={stat}
                  onClick={() =>
                    void roll(
                      100,
                      `${stat.toUpperCase()} check`,
                      Number(me.character![stat]),
                    )
                  }
                >
                  {stat.toUpperCase()} {me.character![stat]}
                </button>
              ))}
            </div>
            <div className="board-skill-actions">
              <span>SKILL CHECKS</span>
              {allSkills(me.character!).map(({ key, label, value }) => {
                const modifier = (me.character!.modifiers || [])
                    .filter((m) => m.target === 'all' || m.target === key)
                    .reduce((n, m) => n + m.amount, 0),
                  adjusted = Math.max(1, Math.min(99, value + modifier));
                return (
                  <button
                    key={key}
                    className={
                      (me.character!.improvementMarks || []).includes(key)
                        ? 'marked'
                        : ''
                    }
                    onClick={() =>
                      void roll(100, `${label} check`, adjusted, key)
                    }
                  >
                    <span>{label}</span>
                    <b>
                      {adjusted}%
                      {modifier
                        ? ` (${modifier > 0 ? '+' : ''}${modifier})`
                        : ''}
                    </b>
                  </button>
                );
              })}
            </div>
            <div className="bonus-dice">
              <span>BONUS / PENALTY DICE</span>
              <div>
                {[-2, -1, 0, 1, 2].map((n) => (
                  <button
                    key={n}
                    className={diceModifier === n ? 'active' : ''}
                    onClick={() => setDiceModifier(n)}
                  >
                    {n < 0
                      ? `${Math.abs(n)} Bonus`
                      : n > 0
                        ? `${n} Penalty`
                        : 'Normal'}
                  </button>
                ))}
              </div>
            </div>
            {lastCheck && lastCheck.outcome === 'Failure' && (
              <div className="roll-followup">
                <b>
                  {lastCheck.check} failed by{' '}
                  {lastCheck.rolled - lastCheck.target}.
                </b>
                <button
                  disabled={
                    (me.character.luck || 0) <
                    lastCheck.rolled - lastCheck.target
                  }
                  onClick={() => void spendLuck()}
                >
                  Spend {lastCheck.rolled - lastCheck.target} Luck
                </button>
                {!lastCheck.pushed && (
                  <button
                    onClick={() =>
                      void roll(
                        100,
                        `${lastCheck.check} (Pushed)`,
                        lastCheck.target,
                        lastCheck.skillKey,
                        true,
                      )
                    }
                  >
                    Push the roll
                  </button>
                )}
              </div>
            )}
            {(me.character.weapons || []).length > 0 && (
              <div className="board-weapons">
                <span>WEAPONS</span>
                {me.character.weapons!.map((w) => {
                  const value =
                    allSkills(me.character!).find((s) => s.key === w.skillKey)
                      ?.value || 0;
                  return (
                    <div key={w.id}>
                      <b>{w.name}</b>
                      <button
                        disabled={w.maxAmmo > 0 && w.ammo <= 0}
                        onClick={() => void attackWeapon(w)}
                      >
                        Attack {value}%
                      </button>
                      <button onClick={() => void damageRoll(w)}>
                        Damage {w.damage}
                      </button>
                      <button
                        onClick={() =>
                          void act({ action: 'reloadWeapon', weaponId: w.id })
                        }
                      >
                        Reload
                      </button>
                      <small>
                        Ammo {w.ammo}/{w.maxAmmo} · Malf {w.malfunction}
                      </small>
                    </div>
                  );
                })}
              </div>
            )}
            {(me.character.spells || []).length > 0 && (
              <div className="board-spells">
                <span>SPELLS & RITUALS</span>
                {me.character.spells!.map((s) => (
                  <button key={s.id} onClick={() => void castSpell(s.id)}>
                    <b>{s.name}</b>
                    <small>
                      {s.cost} · SAN {s.sanityCost} · {s.castingTime}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {campaign.players.filter((p) => p.id !== me.id && p.character)
              .length > 0 && (
              <div className="opposed-check">
                <span>OPPOSED CHECK</span>
                <select
                  value={opposedSkill}
                  onChange={(e) => setOpposedSkill(e.target.value)}
                >
                  {allSkills(me.character).map((s) => (
                    <option value={s.key} key={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                >
                  <option value="">Choose opponent…</option>
                  {campaign.players
                    .filter((p) => p.id !== me.id && p.character)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.character!.name}
                      </option>
                    ))}
                </select>
                <button
                  disabled={!opponentId}
                  onClick={() => void opposedRoll()}
                >
                  Roll opposed check
                </button>
              </div>
            )}
            <div className="board-conditions">
              <span>CONDITIONS</span>
              {conditionCatalog.map((condition) => (
                <button
                  key={condition}
                  className={
                    (me.character!.conditions || []).includes(condition)
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    void act({
                      action: 'toggleCondition',
                      targetId: me.id,
                      condition,
                    })
                  }
                >
                  {condition}
                </button>
              ))}
            </div>
            <button
              className="development-button"
              disabled={!(me.character.improvementMarks || []).length}
              onClick={() =>
                void act({ action: 'resolveDevelopment', targetId: me.id })
              }
            >
              Development phase · {(me.character.improvementMarks || []).length}{' '}
              marked skills
            </button>
            <div className="quick-resource">
              <span>Adjust resources</span>
              {(['hp', 'sanity', 'mp', 'luck'] as const).map((stat) => (
                <div key={stat}>
                  <b>
                    {stat.toUpperCase()} {me.character![stat]}
                  </b>
                  <button
                    onClick={() =>
                      void act({
                        action: 'adjustStat',
                        targetType: 'player',
                        targetId: me.id,
                        stat,
                        delta: -1,
                      })
                    }
                  >
                    −
                  </button>
                  <button
                    onClick={() =>
                      void act({
                        action: 'adjustStat',
                        targetType: 'player',
                        targetId: me.id,
                        stat,
                        delta: 1,
                      })
                    }
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === 'log' && (
          <section className="game-log tabbed-log">
            <div className="section-title">
              <span>SHARED GAME LOG</span>
              <b>{campaign.events.length} entries</b>
            </div>
            <div className="log-scroll" ref={logRef}>
              {campaign.events.length === 0 ? (
                <div className="panel-empty">Nothing has happened yet.</div>
              ) : (
                campaign.events.slice(-50).map((e) => (
                  <div className={`log-item ${e.kind}`} key={e.id}>
                    <time>
                      {new Date(e.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <div>
                      <b>{e.actor}</b>
                      <p>{e.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="message-box">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send();
                }}
                placeholder="Message the table…"
              />
              <button onClick={send}>
                <MessageSquareMore />
              </button>
            </div>
          </section>
        )}
      </aside>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className={`modal-card ${modal === 'maps' ? 'map-manager' : ''}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="entry-brand">
              <Eye />
              <span>
                {modal === 'scene'
                  ? 'SET THE SCENE'
                  : modal === 'maps'
                    ? 'MAP LIBRARY'
                    : 'ADD TO BOARD'}
              </span>
            </div>
            {modal === 'maps' ? (
              <>
                <input
                  ref={mapInput}
                  className="token-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void uploadMap(e.target.files?.[0])}
                />
                <Button
                  onClick={() => {
                    setReplaceMapId('');
                    mapInput.current?.click();
                  }}
                >
                  <ImagePlus /> Upload map
                </Button>
                <div className="map-library">
                  {campaign.maps?.map((map) => (
                    <article
                      key={map.id}
                      className={map.isCurrent ? 'current' : ''}
                    >
                      <img src={map.url} alt="" />
                      <div>
                        <b>{map.name}</b>
                        <small>
                          {map.isCurrent ? 'Current map' : 'Available map'}
                        </small>
                      </div>
                      <button
                        onClick={() => {
                          setReplaceMapId(map.id);
                          mapInput.current?.click();
                        }}
                      >
                        Replace
                      </button>
                      {!map.isCurrent && (
                        <button
                          onClick={() =>
                            void act({ action: 'setCurrentMap', mapId: map.id })
                          }
                        >
                          Use
                        </button>
                      )}
                      <button
                        className="delete-action"
                        aria-label={`Delete ${map.name}`}
                        onClick={() => {
                          if (window.confirm(`Delete ${map.name}?`))
                            void act({ action: 'deleteMap', mapId: map.id });
                        }}
                      >
                        <Trash2 />
                      </button>
                    </article>
                  ))}
                  {!campaign.maps?.length && (
                    <p className="panel-empty">
                      Upload the first map for this campaign.
                    </p>
                  )}
                </div>
              </>
            ) : modal === 'scene' ? (
              <>
                <label>
                  Scene title
                  <input
                    autoFocus
                    value={modalForm.title}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, title: e.target.value })
                    }
                    placeholder="The Last Yellow Car"
                  />
                </label>
                <label>
                  What the investigators see
                  <textarea
                    value={modalForm.description}
                    onChange={(e) =>
                      setModalForm({
                        ...modalForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Rain-black rails vanish into ocean fog…"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Name
                  <input
                    autoFocus
                    value={modalForm.name}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, name: e.target.value })
                    }
                    placeholder="Ambrose Vail"
                  />
                </label>
                <label>
                  Piece type
                  <select
                    value={modalForm.kind}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, kind: e.target.value })
                    }
                  >
                    <option value="npc">NPC</option>
                    <option value="mob">MOB / Threat</option>
                  </select>
                </label>
              </>
            )}
            {modal !== 'maps' && (
              <div className="modal-actions">
                <button onClick={() => setModal(null)}>Cancel</button>
                <Button onClick={submitModal}>
                  {modal === 'scene' ? 'Reveal scene' : 'Add piece'}
                </Button>
              </div>
            )}
            {modal === 'maps' && (
              <div className="modal-actions">
                <Button onClick={() => setModal(null)}>Done</Button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function CharacterSheet({
  character: c,
  showSkills = true,
}: {
  character: Character;
  showSkills?: boolean;
}) {
  const skills = resolvedSkills(c),
    d = derivedStats(c),
    funds = finances(c.credit);
  return (
    <section className="sheet-panel">
      <div className="section-title">
        <span>INVESTIGATOR SHEET</span>
      </div>
      <h2>{c.name}</h2>
      <p>
        {c.occupation} · Age {c.age}
      </p>
      <div className="vitals">
        <span>
          HP{' '}
          <b>
            {c.hp}/{c.maxHp || d.maxHp}
          </b>
        </span>
        <span>
          SAN{' '}
          <b>
            {c.sanity}/{99 - skills.cthulhuMythos}
          </b>
        </span>
        <span>
          MP <b>{c.mp}</b>
        </span>
        <span>
          LUCK <b>{c.luck}</b>
        </span>
      </div>
      <div className="mini-stats">
        {(
          ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu'] as const
        ).map((k) => (
          <span key={k}>
            {k.toUpperCase()} <b>{c[k]}</b>
          </span>
        ))}
      </div>
      <div className="combat-line">
        <span>
          MOV <b>{c.mov ?? d.mov}</b>
        </span>
        <span>
          BUILD <b>{c.build ?? d.build}</b>
        </span>
        <span>
          DB <b>{c.damageBonus || d.damageBonus}</b>
        </span>
      </div>
      {(c.conditions || []).length > 0 && (
        <div className="condition-badges">
          {c.conditions!.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      )}
      {showSkills && (
        <>
          <h3>Skills</h3>
          <div className="sheet-skills">
            {allSkills(c).map((s) => (
              <span
                key={s.key}
                className={
                  (c.improvementMarks || []).includes(s.key) ? 'marked' : ''
                }
              >
                <em>{s.label}</em>
                <b>
                  {s.value}%{' '}
                  {(c.improvementMarks || []).includes(s.key) ? '✓' : ''}
                </b>
              </span>
            ))}
          </div>
        </>
      )}
      {(c.weapons || []).length > 0 && (
        <>
          <h3>Weapons</h3>
          <div className="sheet-weapons">
            {c.weapons!.map((w) => (
              <span key={w.id}>
                <b>{w.name}</b>
                <em>
                  {w.skillName} · {w.damage} · {w.range} · Ammo {w.ammo}/
                  {w.maxAmmo}
                </em>
              </span>
            ))}
          </div>
        </>
      )}
      <h3>Finances & possessions</h3>
      <p>
        Cash {c.cash || funds.cash} · Assets {c.assets || funds.assets} ·
        Spending level {c.spendingLevel || funds.spendingLevel}
      </p>
      <p>{c.possessions || 'No possessions recorded.'}</p>
      {c.chase && (
        <>
          <h3>Chase record</h3>
          <p>
            Speed {c.chase.speed} · Action points {c.chase.actionPoints}
            {c.chase.location ? ` · ${c.chase.location}` : ''}
            {c.chase.vehicle
              ? ` · ${c.chase.vehicle} (Build ${c.chase.vehicleBuild})`
              : ''}
          </p>
          {c.chase.notes && <p>{c.chase.notes}</p>}
        </>
      )}
      {(c.modifiers || []).length > 0 && (
        <>
          <h3>Temporary modifiers</h3>
          {c.modifiers!.map((m) => (
            <p key={m.id}>
              <b>
                {m.amount >= 0 ? '+' : ''}
                {m.amount} {m.target}:
              </b>{' '}
              {m.name} · {m.expires}
            </p>
          ))}
        </>
      )}
      {(c.spells || []).length > 0 && (
        <>
          <h3>Spells</h3>
          {c.spells!.map((s) => (
            <p key={s.id}>
              <b>{s.name}</b> · {s.cost} · SAN {s.sanityCost} · {s.castingTime}
              <br />
              {s.description}
            </p>
          ))}
        </>
      )}
      {(c.tomes || []).length > 0 && (
        <>
          <h3>Mythos tomes</h3>
          {c.tomes!.map((t) => (
            <p key={t.id}>
              <b>{t.title}</b> · {t.language} · Study {t.studyTime}
              <br />
              Mythos {t.mythosGain} · SAN {t.sanityLoss}
              {t.spells ? ` · Spells: ${t.spells}` : ''}
            </p>
          ))}
        </>
      )}
      {(c.sanityEpisodes || []).length > 0 && (
        <>
          <h3>Sanity record</h3>
          {c.sanityEpisodes!.map((ep) => (
            <p key={ep.id}>
              <b>{ep.kind}:</b> {ep.name}
              {ep.notes ? ` — ${ep.notes}` : ''}
            </p>
          ))}
        </>
      )}
      <h3>Sanity anchor</h3>
      <p>{c.anchor}</p>
      <h3>Connection</h3>
      <p>{c.connection || 'Not yet recorded.'}</p>
      {c.backstory && (
        <>
          <h3>Backstory</h3>
          {Object.entries(c.backstory)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <p key={k}>
                <b>{k.replace(/([A-Z])/g, ' $1')}:</b> {v}
              </p>
            ))}
        </>
      )}
    </section>
  );
}
