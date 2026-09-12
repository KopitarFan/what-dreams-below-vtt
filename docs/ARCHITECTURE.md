# Architecture

## System boundaries

The React/Vinext application and REST API run in one Cloudflare Worker. D1 stores accounts, campaigns, game state, integration credentials, and staged imports. R2 stores maps and token images. Durable Objects distribute live-state notifications over WebSockets.

The creative integration deliberately separates generation from publication:

```text
Codex / ChatGPT / CLI / MCP client
        │ bearer token
        ▼
Remote MCP or versioned REST API
        │ validation
        ▼
Keeper staging inbox
        │ explicit approval
        ▼
Campaign data + live notifications
```

## Design decisions

- One Zod schema is the runtime source of truth for clients, the API, tests, and documentation examples.
- Integration credentials are campaign-scoped and hashed at rest.
- Creative context excludes private player notes, secrets, account details, and session credentials.
- Imports are immutable drafts until approved or rejected.
- The typed client contains HTTP behavior; the CLI contains argument parsing and filesystem concerns.
- The core VTT does not depend on any AI provider.
- MCP uses stateless Streamable HTTP; durable campaign state remains in D1 and R2.
- Generated media is staged in R2 and remains unavailable through its public route until Keeper approval.

## Repository map

- `app/` — web interface and Worker API routes
- `db/` and `drizzle/` — schema and additive migrations
- `lib/content-schema.ts` — versioned content contract
- `lib/vtt-api-client.ts` — reusable typed client
- `tools/vtt-cli.ts` — command-line workflow
- `integrations/codex-skill/` — reusable Codex instructions
- `mcp/` — authenticated, goal-oriented remote MCP server
- `lib/asset-service.ts` — format, size, source, and R2 storage boundary
- `examples/content-packs/` — valid packages for documentation and tests
- `tests/` — schema and client contract tests

## MCP tools

- `get_campaign_context` reads the sanitized creative brief.
- `stage_content_package` submits structured work for approval.
- `upload_generated_asset` copies temporary generated imagery into R2 for approval.
- `list_staged_work` reports content and media review status.

Tools are intentionally goal-oriented rather than mirroring every REST endpoint. This keeps agent context small and prevents direct mutation of the live board.
