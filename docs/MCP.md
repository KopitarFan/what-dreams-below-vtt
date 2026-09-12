# Remote MCP integration

The VTT exposes a stateless Streamable HTTP MCP server at:

```text
https://what-dream-below-vtt.friarpuck.com/mcp
```

It uses the same campaign-scoped bearer credentials as the REST API. Create a fresh token under **Keeper → Creative imports** and copy it when shown. The server never receives the Keeper's password or browser session.

## Connect Codex

Put the token in an environment variable, then register the remote server:

```bash
export WDB_VTT_TOKEN='wdb_...'
codex mcp add what-dreams-below \
  --url https://what-dream-below-vtt.friarpuck.com/mcp \
  --bearer-token-env-var WDB_VTT_TOKEN
```

Restart Codex after adding the server. Keep the token out of prompts, source files, screenshots, and shell history. Revoke it from the Keeper dashboard if it is exposed.

## Recommended creative loop

1. Read campaign context.
2. Generate one coherent unit of work.
3. Stage structured content and any generated media.
4. Report exactly what was staged.
5. Let the Keeper approve or delete each item in the VTT.

The MCP server deliberately cannot approve content, move tokens, reveal handouts, or otherwise alter the live session.

## Tools

| Tool                     | Scope           | Purpose                                                    |
| ------------------------ | --------------- | ---------------------------------------------------------- |
| `get_campaign_context`   | `context:read`  | Read the sanitized campaign brief.                         |
| `stage_content_package`  | `imports:write` | Validate and stage scenes, cast, handouts, and encounters. |
| `upload_generated_asset` | `assets:write`  | Copy a temporary HTTPS image into R2 for review.           |
| `list_staged_work`       | `imports:write` | Check current review status.                               |

## Troubleshooting

- HTTP 401 means the token is missing, invalid, or revoked.
- A scope error usually means the token predates media support; create a new token.
- The `/mcp` URL is a protocol endpoint, not a normal web page. Use Codex or MCP Inspector to connect.
- Media remains unavailable at its stable URL until the Keeper approves it.
