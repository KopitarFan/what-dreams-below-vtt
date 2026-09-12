import { createMcpHandler } from 'agents/mcp/server';
import { McpServer, type AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { assetKindSchema, contentPackageSchema } from '../lib/content-schema';
import { storeAssetFromUrl, type AssetStore } from '../lib/asset-service';

type McpEnvironment = AssetStore;

function result(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function failure(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text:
          error instanceof Error ? error.message : 'Unexpected MCP tool error.',
      },
    ],
  };
}

function campaignId(authInfo?: AuthInfo) {
  const value = authInfo?.extra?.campaignId;
  if (typeof value !== 'string' || !value)
    throw new Error('Campaign authorization is missing.');
  return value;
}

function requireScope(authInfo: AuthInfo | undefined, scope: string) {
  if (!authInfo?.scopes.includes(scope))
    throw new Error(`The token requires the ${scope} scope.`);
}

async function campaignContext(env: McpEnvironment, id: string) {
  const campaign = await env.DB.prepare(
    'SELECT id,name,year,location,status,session_number AS sessionNumber,scene_title AS sceneTitle,scene_description AS sceneDescription FROM campaigns WHERE id = ?',
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!campaign) throw new Error('Campaign not found.');
  const [players, scenes, pieces] = await Promise.all([
    env.DB.prepare(
      'SELECT name,character_json AS characterJson FROM players WHERE campaign_id = ?',
    )
      .bind(id)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      'SELECT chapter,title,description,objective,clues,status FROM scenes WHERE campaign_id = ? ORDER BY sort_order',
    )
      .bind(id)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      'SELECT name,kind,details_json AS detailsJson FROM board_pieces WHERE campaign_id = ?',
    )
      .bind(id)
      .all<Record<string, unknown>>(),
  ]);
  return {
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
    investigators: players.results.flatMap((row) => {
      if (typeof row.characterJson !== 'string') return [];
      const character = JSON.parse(row.characterJson) as Record<
        string,
        unknown
      >;
      return [
        {
          name: character.name,
          occupation: character.occupation,
          age: character.age,
          characteristics: Object.fromEntries(
            ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu'].map(
              (key) => [key, character[key]],
            ),
          ),
          hp: character.hp,
          sanity: character.sanity,
          skills: character.skills || {},
          conditions: character.conditions || [],
          publicBackstory: character.backstory || {},
        },
      ];
    }),
    scenes: scenes.results,
    cast: pieces.results.map((row) => ({
      name: row.name,
      kind: row.kind,
      ...(typeof row.detailsJson === 'string'
        ? JSON.parse(row.detailsJson)
        : {}),
    })),
    creativeDirection:
      '1920s Los Angeles hardboiled detective noir, Lovecraftian mythos, dreams, memory, and unreality.',
  };
}

function createServer(env: McpEnvironment, authInfo?: AuthInfo) {
  const server = new McpServer({
    name: 'what-dreams-below-vtt',
    version: '1.0.0',
  });

  server.registerTool(
    'get_campaign_context',
    {
      title: 'Read campaign context',
      description:
        "Read the authorized campaign's approved setting, investigators, scenes, and cast before generating material. Never invent campaign facts when this tool is available.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        requireScope(authInfo, 'context:read');
        return result(await campaignContext(env, campaignId(authInfo)));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'stage_content_package',
    {
      title: 'Stage campaign content',
      description:
        "Validate and place generated scenes, NPCs, MOBs, handouts, and encounters into the Keeper's review inbox. This never changes the live campaign until the Keeper approves it.",
      inputSchema: contentPackageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => {
      try {
        requireScope(authInfo, 'imports:write');
        const content = contentPackageSchema.parse(input);
        const id = `import_${crypto.randomUUID()}`;
        await env.DB.prepare(
          'INSERT INTO content_imports (id,campaign_id,status,source,title,package_json,validation_json,created_at) VALUES (?,?,?,?,?,?,?,?)',
        )
          .bind(
            id,
            campaignId(authInfo),
            'pending',
            content.source,
            content.title,
            JSON.stringify(content),
            JSON.stringify({
              valid: true,
              schemaVersion: content.schemaVersion,
            }),
            Date.now(),
          )
          .run();
        return result({
          id,
          status: 'pending',
          title: content.title,
          reviewUrl: `/?campaign=${encodeURIComponent(campaignId(authInfo))}&screen=keeper&section=imports`,
        });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'upload_generated_asset',
    {
      title: 'Upload generated media',
      description:
        "Fetch a generated image from a temporary HTTPS URL and store it in the campaign's private Cloudflare R2 workflow. The Keeper must approve it before its stable URL becomes viewable.",
      inputSchema: z.object({
        sourceUrl: z
          .url()
          .describe('Temporary HTTPS URL for the generated image.'),
        name: z.string().min(1).max(120).describe('Human-readable asset name.'),
        kind: assetKindSchema.describe('How the VTT will use this image.'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => {
      try {
        requireScope(authInfo, 'assets:write');
        const asset = await storeAssetFromUrl(env, campaignId(authInfo), input);
        return result({
          ...asset,
          reviewUrl: `/?campaign=${encodeURIComponent(campaignId(authInfo))}&screen=keeper&section=imports`,
        });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'list_staged_work',
    {
      title: 'List staged creative work',
      description:
        'List recent generated content packages and media with their Keeper-review status.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ limit }) => {
      try {
        requireScope(authInfo, 'imports:write');
        const id = campaignId(authInfo);
        const [imports, assets] = await Promise.all([
          env.DB.prepare(
            'SELECT id,title,source,status,created_at AS createdAt FROM content_imports WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?',
          )
            .bind(id, limit)
            .all(),
          env.DB.prepare(
            'SELECT id,name,kind,status,content_type AS contentType,byte_size AS byteSize,created_at AS createdAt FROM integration_assets WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?',
          )
            .bind(id, limit)
            .all(),
        ]);
        return result({ imports: imports.results, assets: assets.results });
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

export function createVttMcpHandler(env: McpEnvironment, authInfo: AuthInfo) {
  return createMcpHandler(() => createServer(env, authInfo), {
    route: '/mcp',
    corsOptions: false,
  });
}
