import type { AuthInfo } from '@modelcontextprotocol/server';

type AuthEnvironment = { DB: D1Database };

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function authenticateMcpRequest(
  request: Request,
  env: AuthEnvironment,
  ctx: ExecutionContext,
): Promise<AuthInfo | null> {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS integration_assets (id text PRIMARY KEY NOT NULL,campaign_id text NOT NULL,name text NOT NULL,kind text NOT NULL,status text DEFAULT 'pending' NOT NULL,object_key text NOT NULL UNIQUE,content_type text NOT NULL,byte_size integer NOT NULL,source_url text,created_at integer NOT NULL,approved_at integer,FOREIGN KEY (campaign_id) REFERENCES campaigns(id))",
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_integration_assets_campaign ON integration_assets (campaign_id)',
  ).run();
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT id,campaign_id AS campaignId,scopes,revoked_at AS revokedAt FROM integration_tokens WHERE token_hash = ?',
  )
    .bind(await sha256(token))
    .first<{
      id: string;
      campaignId: string;
      scopes: string;
      revokedAt: number | null;
    }>();
  if (!row || row.revokedAt) return null;
  ctx.waitUntil(
    env.DB.prepare(
      'UPDATE integration_tokens SET last_used_at = ? WHERE id = ?',
    )
      .bind(Date.now(), row.id)
      .run(),
  );
  return {
    token,
    clientId: row.id,
    scopes: row.scopes.split(','),
    extra: { campaignId: row.campaignId },
  };
}

export function mcpUnauthorized() {
  return Response.json(
    { error: 'A valid campaign integration bearer token is required.' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="What Dreams Below VTT"',
        'Cache-Control': 'no-store',
      },
    },
  );
}
