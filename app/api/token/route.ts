import { and, eq, gt } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { accountSessions, campaigns, players } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('veil_session')?.value;
  const playerId = request.nextUrl.searchParams.get('playerId') ?? '';
  if (!token || !playerId) return new NextResponse(null, { status: 401 });

  const db = getDb();
  const session = await db
    .select()
    .from(accountSessions)
    .where(
      and(
        eq(accountSessions.token, token),
        gt(accountSessions.expiresAt, Date.now()),
      ),
    )
    .get();
  if (!session) return new NextResponse(null, { status: 401 });

  const target = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();
  if (!target?.tokenKey) return new NextResponse(null, { status: 404 });
  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, target.campaignId))
    .get();
  const member = await db
    .select()
    .from(players)
    .where(
      and(
        eq(players.campaignId, target.campaignId),
        eq(players.accountId, session.accountId),
      ),
    )
    .get();
  if (campaign?.keeperAccountId !== session.accountId && !member)
    return new NextResponse(null, { status: 403 });

  const object = await env.TOKEN_IMAGES.get(target.tokenKey);
  if (!object) return new NextResponse(null, { status: 404 });
  return new NextResponse(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'image/webp',
      'cache-control': 'private, no-store',
    },
  });
}
