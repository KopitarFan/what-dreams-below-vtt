import { describe, expect, it, vi } from 'vitest';
import { VttApiClient, VttApiError } from '../lib/vtt-api-client';
import example from '../examples/content-packs/empty-platform.json';

describe('VttApiClient', () => {
  it('sends scoped bearer authentication', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ campaign: { name: 'Test' } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    const client = new VttApiClient({
      baseUrl: 'https://vtt.example/',
      campaignId: 'case 1',
      token: 'secret',
      fetch: fetcher,
    });
    await client.getContext();
    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetcher).mock.calls[0];
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer secret',
    );
  });
  it('validates imports before transmission', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'i1',
            status: 'pending',
            title: 'Example',
            reviewUrl: '/',
          }),
          { status: 202 },
        ),
    ) as unknown as typeof fetch;
    const client = new VttApiClient({
      baseUrl: 'https://vtt.example',
      campaignId: 'c1',
      token: 'secret',
      fetch: fetcher,
    });
    await client.submitImport(example);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('returns typed API errors', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
        }),
    ) as unknown as typeof fetch;
    const client = new VttApiClient({
      baseUrl: 'https://vtt.example',
      campaignId: 'c1',
      token: 'bad',
      fetch: fetcher,
    });
    await expect(client.getContext()).rejects.toBeInstanceOf(VttApiError);
  });
  it('uploads binary assets without overriding the multipart boundary', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'asset_1' }), { status: 202 }),
    );
    const fetcher = fetchMock as unknown as typeof fetch;
    const client = new VttApiClient({
      baseUrl: 'https://vtt.example',
      campaignId: 'c1',
      token: 'secret',
      fetch: fetcher,
    });
    await client.uploadAssetFile({
      file: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      filename: 'map.png',
      name: 'Test map',
      kind: 'map',
    });
    const init = fetchMock.mock.calls[0][1];
    expect(init).toBeDefined();
    if (!init) throw new Error('Missing request options.');
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).has('content-type')).toBe(false);
  });
});
