import { env } from 'cloudflare:workers';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { integrationTokens } from '@/db/schema';

let ready = false;
export async function ensureIntegrationTables() {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS integration_tokens (id text PRIMARY KEY NOT NULL,campaign_id text NOT NULL,name text NOT NULL,prefix text NOT NULL,token_hash text NOT NULL UNIQUE,scopes text NOT NULL,revoked_at integer,last_used_at integer,created_at integer NOT NULL,FOREIGN KEY (campaign_id) REFERENCES campaigns(id))',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_integration_tokens_campaign ON integration_tokens (campaign_id)',
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS content_imports (id text PRIMARY KEY NOT NULL,campaign_id text NOT NULL,status text DEFAULT 'pending' NOT NULL,source text NOT NULL,title text NOT NULL,package_json text NOT NULL,validation_json text DEFAULT '{}' NOT NULL,created_at integer NOT NULL,approved_at integer,FOREIGN KEY (campaign_id) REFERENCES campaigns(id))",
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_content_imports_campaign ON content_imports (campaign_id)',
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS integration_assets (id text PRIMARY KEY NOT NULL,campaign_id text NOT NULL,name text NOT NULL,kind text NOT NULL,status text DEFAULT 'pending' NOT NULL,object_key text NOT NULL UNIQUE,content_type text NOT NULL,byte_size integer NOT NULL,source_url text,created_at integer NOT NULL,approved_at integer,FOREIGN KEY (campaign_id) REFERENCES campaigns(id))",
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_integration_assets_campaign ON integration_assets (campaign_id)',
    ),
  ]);
  ready = true;
}
export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value),
    hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export function apiError(message: string, status = 400) {
  return Response.json(
    { error: message },
    { status, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
export async function integrationAuth(
  request: Request,
  campaignId: string,
  scope: string,
) {
  await ensureIntegrationTables();
  const header = request.headers.get('authorization') || '',
    token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const hash = await sha256(token),
    row = await getDb()
      .select()
      .from(integrationTokens)
      .where(
        and(
          eq(integrationTokens.tokenHash, hash),
          eq(integrationTokens.campaignId, campaignId),
        ),
      )
      .get();
  if (!row || row.revokedAt || !row.scopes.split(',').includes(scope))
    return null;
  await getDb()
    .update(integrationTokens)
    .set({ lastUsedAt: Date.now() })
    .where(eq(integrationTokens.id, row.id));
  return row;
}
