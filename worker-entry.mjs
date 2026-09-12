import appWorker from './dist/server/index.js';
import { DurableObject } from 'cloudflare:workers';
import { authenticateMcpRequest, mcpUnauthorized } from './mcp/auth.ts';
import { createVttMcpHandler } from './mcp/server.ts';

export class GameRoom extends DurableObject {
  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('Upgrade required', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(sender, message) {
    if (typeof message !== 'string' || message.length > 100) return;
    const update = JSON.stringify({ type: 'refresh', at: Date.now() });
    for (const socket of this.ctx.getWebSockets())
      if (socket !== sender)
        try {
          socket.send(update);
        } catch {}
  }
}

function cookie(request, name) {
  const value = request.headers.get('cookie') || '';
  for (const part of value.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

async function canJoin(request, env, campaignId) {
  const token = cookie(request, 'veil_session');
  if (!token || !campaignId) return false;
  const session = await env.DB.prepare(
    'SELECT account_id FROM account_sessions WHERE token = ? AND expires_at > ?',
  )
    .bind(token, Date.now())
    .first();
  if (!session) return false;
  const access = await env.DB.prepare(
    'SELECT 1 AS ok FROM campaigns c LEFT JOIN players p ON p.campaign_id = c.id AND p.account_id = ? WHERE c.id = ? AND (c.keeper_account_id = ? OR p.id IS NOT NULL) LIMIT 1',
  )
    .bind(session.account_id, campaignId, session.account_id)
    .first();
  return Boolean(access?.ok);
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/mcp') {
      const authInfo = await authenticateMcpRequest(request, env, ctx);
      if (!authInfo) return mcpUnauthorized();
      return createVttMcpHandler(env, authInfo).fetch(request, { authInfo });
    }
    if (url.pathname === '/api/live') {
      const campaignId = url.searchParams.get('campaign') || '';
      if (!(await canJoin(request, env, campaignId)))
        return new Response('Unauthorized', { status: 401 });
      const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(campaignId));
      return room.fetch(request);
    }
    return appWorker.fetch(request, env, ctx);
  },
};

export default worker;
