import { assetKindSchema, type AssetKind } from './content-schema';

export const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export type AssetStore = {
  DB: D1Database;
  TOKEN_IMAGES: R2Bucket;
};

export type StoredAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  status: 'pending';
  contentType: string;
  byteSize: number;
  url: string;
  createdAt: number;
};

function safeRemoteUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:')
    throw new Error('Asset source must use HTTPS.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const octets = host.split('.').map(Number);
  const privateIpv4 =
    octets.length === 4 &&
    octets.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 255,
    ) &&
    (octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168));
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:') ||
    privateIpv4 ||
    host.endsWith('.local')
  )
    throw new Error('Private or local asset sources are not allowed.');
  return url;
}

async function readLimited(response: Response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_ASSET_BYTES)
    throw new Error('Asset exceeds the 12 MB limit.');
  if (!response.body) throw new Error('The asset source returned no content.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ASSET_BYTES) {
      await reader.cancel();
      throw new Error('Asset exceeds the 12 MB limit.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function storeAsset(
  store: AssetStore,
  campaignId: string,
  input: {
    name: string;
    kind: AssetKind;
    contentType: string;
    bytes: Uint8Array;
    sourceUrl?: string;
  },
): Promise<StoredAsset> {
  const kind = assetKindSchema.parse(input.kind);
  if (!ALLOWED_TYPES.has(input.contentType))
    throw new Error('Supported formats are PNG, JPEG, WebP, and GIF.');
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_ASSET_BYTES)
    throw new Error('Asset must be between 1 byte and 12 MB.');
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error('Asset name is required.');
  const id = `asset_${crypto.randomUUID()}`;
  const extension =
    input.contentType === 'image/jpeg'
      ? 'jpg'
      : input.contentType.split('/')[1];
  const objectKey = `creative/${campaignId}/${id}.${extension}`;
  const createdAt = Date.now();
  await store.TOKEN_IMAGES.put(objectKey, input.bytes, {
    httpMetadata: {
      contentType: input.contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { campaignId, assetId: id, kind },
  });
  try {
    await store.DB.prepare(
      'INSERT INTO integration_assets (id,campaign_id,name,kind,status,object_key,content_type,byte_size,source_url,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(
        id,
        campaignId,
        name,
        kind,
        'pending',
        objectKey,
        input.contentType,
        input.bytes.byteLength,
        input.sourceUrl || null,
        createdAt,
      )
      .run();
  } catch (error) {
    await store.TOKEN_IMAGES.delete(objectKey);
    throw error;
  }
  return {
    id,
    name,
    kind,
    status: 'pending',
    contentType: input.contentType,
    byteSize: input.bytes.byteLength,
    url: `/api/v1/assets/${encodeURIComponent(id)}`,
    createdAt,
  };
}

export async function storeAssetFromUrl(
  store: AssetStore,
  campaignId: string,
  input: { sourceUrl: string; name: string; kind: AssetKind },
) {
  const source = safeRemoteUrl(input.sourceUrl);
  const response = await fetch(source, {
    redirect: 'follow',
    headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
  });
  if (!response.ok)
    throw new Error(`Asset source returned HTTP ${response.status}.`);
  safeRemoteUrl(response.url);
  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return storeAsset(store, campaignId, {
    ...input,
    contentType,
    bytes: await readLimited(response),
  });
}
