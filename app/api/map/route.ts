import { and, eq, gt } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { accountSessions, campaignMaps, campaigns, players } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('veil_session')?.value,
    mapId = request.nextUrl.searchParams.get('id') ?? '';
  if (!token || !mapId) return new NextResponse(null, { status: 401 });
  const db = getDb(),
    session = await db
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
  const map = await db
    .select()
    .from(campaignMaps)
    .where(eq(campaignMaps.id, mapId))
    .get();
  if (!map) return new NextResponse(null, { status: 404 });
  const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, map.campaignId))
      .get(),
    member = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.campaignId, map.campaignId),
          eq(players.accountId, session.accountId),
        ),
      )
      .get();
  if (campaign?.keeperAccountId !== session.accountId && !member)
    return new NextResponse(null, { status: 403 });
  const object = await env.TOKEN_IMAGES.get(map.objectKey);
  if (!object) return new NextResponse(null, { status: 404 });
  return new NextResponse(object.body, {
    headers: {
      'content-type': map.contentType,
      'cache-control': 'private, no-store',
    },
  });
}
