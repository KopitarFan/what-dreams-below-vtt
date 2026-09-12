# Contributing

## Development workflow

Use Node.js 22.13 or newer and install the lockfile's exact dependency set:

```bash
npm ci
```

Before opening a pull request, run:

```bash
npm run check
```

The quality gate verifies formatting, application lint rules, TypeScript, automated tests, and the production Worker build. GitHub Actions runs the same command for pushes to `main` and for pull requests.

## Code organization

- Keep route handlers focused on HTTP concerns.
- Put reusable validation and domain behavior under `lib/`.
- Keep Cloudflare MCP tools under `mcp/` and make them goal-oriented rather than mirroring every endpoint.
- Add D1 schema changes to `db/schema.ts` with an additive migration under `drizzle/`.
- Store large binary payloads in R2 and relational metadata in D1.
- Add or update tests for observable behavior.

The files under `components/ui/` are generated UI primitives and are excluded from application linting. Changes there should stay minimal and compatible with their upstream component contracts.

## Security expectations

Never commit credentials, bearer tokens, `.dev.vars`, campaign exports, or private player data. Generated content must remain staged until the Keeper explicitly approves it. See [SECURITY.md](SECURITY.md) for reporting and operational guidance.
