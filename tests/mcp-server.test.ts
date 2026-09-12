import { describe, expect, it } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { createVttMcpHandler } from '../mcp/server';

describe('remote MCP server', () => {
  it('negotiates the Streamable HTTP protocol and advertises tools', async () => {
    const authInfo: AuthInfo = {
      token: 'test',
      clientId: 'integration_test',
      scopes: ['context:read', 'imports:write', 'assets:write'],
      extra: { campaignId: 'campaign_test' },
    };
    const request = new Request(
      'https://what-dream-below-vtt.friarpuck.com/mcp',
      {
        method: 'POST',
        headers: {
          host: 'what-dream-below-vtt.friarpuck.com',
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'vitest', version: '1.0.0' },
          },
        }),
      },
    );
    const response = await createVttMcpHandler(
      { DB: {} as D1Database, TOKEN_IMAGES: {} as R2Bucket },
      authInfo,
    ).fetch(request, { authInfo });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(body).toContain('what-dreams-below-vtt');
    expect(body).toContain('tools');
  });
});
