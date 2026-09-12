import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { assetKindSchema } from '@/lib/content-schema';
import {
  MAX_ASSET_BYTES,
  storeAsset,
  storeAssetFromUrl,
} from '@/lib/asset-service';
import {
  apiError,
  ensureIntegrationTables,
  integrationAuth,
} from '@/lib/integration-api';

export const dynamic = 'force-dynamic';
const remoteAssetSchema = z.object({
  sourceUrl: z.url(),
  name: z.string().min(1).max(120),
  kind: assetKindSchema,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  if (!(await integrationAuth(request, campaignId, 'assets:write')))
    return apiError('Valid assets:write bearer token required.', 401);
  try {
    const contentType = request.headers.get('content-type') || '';
    let asset;
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File))
        return apiError('A file field is required.', 422);
      if (file.size > MAX_ASSET_BYTES)
        return apiError('Asset exceeds the 12 MB limit.', 413);
      const kind = assetKindSchema.parse(form.get('kind'));
      const requestedName = form.get('name');
      asset = await storeAsset(env, campaignId, {
        name: typeof requestedName === 'string' ? requestedName : file.name,
        kind,
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } else {
      const parsed = remoteAssetSchema.safeParse(await request.json());
      if (!parsed.success)
        return apiError(
          'sourceUrl, name, and a valid asset kind are required.',
          422,
        );
      asset = await storeAssetFromUrl(env, campaignId, parsed.data);
    }
    return Response.json(
      {
        ...asset,
        reviewUrl: `/?campaign=${encodeURIComponent(campaignId)}&screen=keeper&section=imports`,
      },
      { status: 202, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Asset upload failed.',
      422,
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  if (!(await integrationAuth(request, campaignId, 'context:read')))
    return apiError('Valid context:read bearer token required.', 401);
  await ensureIntegrationTables();
  const rows = await env.DB.prepare(
    'SELECT id,name,kind,status,content_type AS contentType,byte_size AS byteSize,created_at AS createdAt,approved_at AS approvedAt FROM integration_assets WHERE campaign_id = ? ORDER BY created_at DESC',
  )
    .bind(campaignId)
    .all();
  return Response.json(
    { assets: rows.results },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
  });
}
