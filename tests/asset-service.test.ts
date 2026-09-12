import { describe, expect, it, vi } from 'vitest';
import { MAX_ASSET_BYTES, storeAsset } from '../lib/asset-service';

function store() {
  const run = vi.fn(async () => ({ success: true }));
  const put = vi.fn(async () => ({ key: 'key' }));
  return {
    DB: {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })),
    } as unknown as D1Database,
    TOKEN_IMAGES: {
      put,
      delete: vi.fn(async () => undefined),
    } as unknown as R2Bucket,
    put,
  };
}

describe('generated asset storage', () => {
  it('stores valid images under opaque campaign keys', async () => {
    const target = store();
    const asset = await storeAsset(target, 'campaign_1', {
      name: 'The boathouse',
      kind: 'map',
      contentType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(asset.id).toMatch(/^asset_/);
    expect(asset.status).toBe('pending');
    expect(target.put).toHaveBeenCalledWith(
      expect.stringMatching(/^creative\/campaign_1\/asset_.*\.png$/),
      expect.any(Uint8Array),
      expect.any(Object),
    );
  });

  it('rejects unsupported content types before writing', async () => {
    const target = store();
    await expect(
      storeAsset(target, 'campaign_1', {
        name: 'Unsafe',
        kind: 'handout',
        contentType: 'text/html',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow('Supported formats');
    expect(target.put).not.toHaveBeenCalled();
  });

  it('rejects files over the configured limit', async () => {
    const target = store();
    await expect(
      storeAsset(target, 'campaign_1', {
        name: 'Huge map',
        kind: 'map',
        contentType: 'image/png',
        bytes: new Uint8Array(MAX_ASSET_BYTES + 1),
      }),
    ).rejects.toThrow('between 1 byte and 12 MB');
  });
});
