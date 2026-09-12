import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { campaigns, players, scenes, boardPieces } from '@/db/schema';
import { apiError, integrationAuth } from '@/lib/integration-api';
import type { Character, PieceDetails } from '@/lib/game-types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  if (!(await integrationAuth(request, campaignId, 'context:read')))
    return apiError('Valid context:read bearer token required.', 401);
  const db = getDb(),
    campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .get();
  if (!campaign) return apiError('Campaign not found.', 404);
  const members = await db
      .select()
      .from(players)
      .where(eq(players.campaignId, campaignId))
      .all(),
    sceneRows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.campaignId, campaignId))
      .all(),
    pieces = await db
      .select()
      .from(boardPieces)
      .where(eq(boardPieces.campaignId, campaignId))
      .all();
  return Response.json(
    {
      schemaVersion: '1.0',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        year: campaign.year,
        location: campaign.location,
        status: campaign.status,
        sessionNumber: campaign.sessionNumber,
        currentScene: {
          title: campaign.sceneTitle,
          description: campaign.sceneDescription,
        },
      },
      investigators: members
        .filter((p) => p.characterJson)
        .map((p) => {
          const c = JSON.parse(p.characterJson!) as Character;
          return {
            name: c.name,
            occupation: c.occupation,
            age: c.age,
            characteristics: {
              str: c.str,
              con: c.con,
              siz: c.siz,
              dex: c.dex,
              app: c.app,
              int: c.int,
              pow: c.pow,
              edu: c.edu,
            },
            hp: c.hp,
            sanity: c.sanity,
            skills: c.skills || {},
            conditions: c.conditions || [],
            publicBackstory: c.backstory || {},
          };
        }),
      scenes: sceneRows.map((s) => ({
        chapter: s.chapter,
        title: s.title,
        description: s.description,
        objective: s.objective,
        clues: s.clues,
        status: s.status,
      })),
      cast: pieces.map((p) => {
        const d = JSON.parse(p.detailsJson || '{}') as PieceDetails;
        return {
          name: p.name,
          kind: p.kind,
          description: d.description || '',
          motivation: d.motivation || '',
          hook: d.hook || '',
        };
      }),
      creativeDirection:
        '1920s Los Angeles hardboiled detective noir, Lovecraftian mythos, dreams, memory, and unreality.',
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
