# Security

Please report vulnerabilities privately to the repository owner rather than opening a public issue containing exploit details.

## Integration-token handling

- Treat campaign tokens like passwords.
- Prefer `WDB_VTT_TOKEN` over command-line arguments.
- Never commit tokens, context exports, production databases, or `.env` files.
- Revoke a token immediately if it appears in logs, screenshots, shell history, or generated content.
- Use a separate token per tool or collaborator so access can be revoked independently.

The server stores only token hashes and a short non-secret prefix. Integration tokens can read a restricted creative brief and stage drafts; they cannot approve content or operate the live board.

## Supported reports

Useful reports include authentication bypasses, cross-campaign access, Keeper-only data exposure, unsafe file handling, stored cross-site scripting, and unauthorized live-game mutation. Include reproduction steps, impact, and the affected version when possible.
