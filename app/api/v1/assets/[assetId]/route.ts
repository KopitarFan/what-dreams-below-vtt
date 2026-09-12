import { env } from 'cloudflare:workers';
import { ensureIntegrationTables } from '@/lib/integration-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  await ensureIntegrationTables();
  const { assetId } = await params;
  const row = await env.DB.prepare(
    "SELECT object_key AS objectKey FROM integration_assets WHERE id = ? AND status = 'approved'",
  )
    .bind(assetId)
    .first<{ objectKey: string }>();
  if (!row)
    return Response.json({ error: 'Asset not found.' }, { status: 404 });
  const object = await env.TOKEN_IMAGES.get(row.objectKey, {
    onlyIf: request.headers,
  });
  if (!object)
    return Response.json({ error: 'Asset unavailable.' }, { status: 404 });
  if (!('body' in object))
    return new Response(null, {
      status: 304,
      headers: { ETag: object.httpEtag },
    });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
