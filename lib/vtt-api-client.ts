import { contentPackageSchema, type ContentPackage } from './content-schema';

export type ClientOptions = {
  baseUrl: string;
  campaignId: string;
  token: string;
  fetch?: typeof globalThis.fetch;
};
export type ImportSummary = {
  id: string;
  title: string;
  source: string;
  status: string;
  createdAt: number;
};
export type AssetKind = 'map' | 'token' | 'portrait' | 'handout' | 'sticker';
export type AssetSummary = {
  id: string;
  name: string;
  kind: AssetKind;
  status: string;
  contentType: string;
  byteSize: number;
  createdAt: number;
};

export class VttApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'VttApiError';
  }
}

export class VttApiClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly baseUrl: string;
  constructor(private readonly options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetch || globalThis.fetch;
  }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.options.token}`);
    headers.set('accept', 'application/json');
    if (init.body && !(init.body instanceof FormData))
      headers.set('content-type', 'application/json');
    const response = await this.fetcher(
        `${this.baseUrl}/api/v1/campaigns/${encodeURIComponent(this.options.campaignId)}${path}`,
        {
          ...init,
          headers,
        },
      ),
      text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new VttApiError(
        'The VTT returned an invalid JSON response.',
        response.status,
        text,
      );
    }
    if (!response.ok) {
      const message =
        typeof data === 'object' && data && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${response.status}).`;
      throw new VttApiError(message, response.status, data);
    }
    return data as T;
  }
  getContext<T = unknown>() {
    return this.request<T>('/context');
  }
  async submitImport(input: unknown) {
    const content = contentPackageSchema.parse(input);
    return this.request<{
      id: string;
      status: 'pending';
      title: string;
      reviewUrl: string;
    }>('/imports', { method: 'POST', body: JSON.stringify(content) });
  }
  listImports() {
    return this.request<{ imports: ImportSummary[] }>('/imports');
  }
  uploadAssetFromUrl(input: {
    sourceUrl: string;
    name: string;
    kind: AssetKind;
  }) {
    return this.request<AssetSummary & { reviewUrl: string }>('/assets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  async uploadAssetFile(input: {
    file: Blob;
    filename: string;
    name: string;
    kind: AssetKind;
  }) {
    const form = new FormData();
    form.set('file', input.file, input.filename);
    form.set('name', input.name);
    form.set('kind', input.kind);
    return this.request<AssetSummary & { reviewUrl: string }>('/assets', {
      method: 'POST',
      body: form,
    });
  }
  listAssets() {
    return this.request<{ assets: AssetSummary[] }>('/assets');
  }
}

export function validateContentPackage(input: unknown): ContentPackage {
  return contentPackageSchema.parse(input);
}
