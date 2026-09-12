# What Dreams Below VTT

A real-time, web-based investigative-horror virtual tabletop built with TypeScript, React, Cloudflare Workers, Durable Objects, D1, and R2. It provides persistent Keeper and player accounts, campaign management, Call of Cthulhu 7e investigator mechanics, synchronized maps and tokens, encounter tools, and a provider-neutral creative-content API.

> **Fan project:** This project is not affiliated with or endorsed by Chaosium Inc. “Call of Cthulhu” is a trademark of Chaosium Inc. No commercial rulebook text or artwork is distributed with this repository.

## Highlights

- Role-specific Keeper and player applications
- Live token movement, drawing, fog, dice, and game log
- Complete investigator creation and play workflows
- Encounter initiative, handouts, private messages, NPCs, MOBs, and loot
- Scoped REST and remote MCP integrations with a Keeper approval boundary
- R2-backed generated maps, tokens, portraits, handouts, and stickers
- Shared Zod validation, typed API client, CLI, and Codex workflow

## Local development

Requirements: Node.js 22.18 or newer and a Cloudflare account for remote resources.

```bash
npm install
npm run dev
```

Run quality checks with:

```bash
npm run check
```

Build the production Worker with:

```bash
npm run build
```

## Run with Docker

Requirements: Docker Engine 24 or newer with Docker Compose.

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The container applies the
local D1 migrations before starting and stores accounts, campaigns, uploaded
media, and Durable Object state in the `vtt-data` Docker volume. Restarting or
rebuilding the container preserves that data.

To run in the background and follow its logs:

```bash
npm run docker:up
npm run docker:logs
```

Stop the app without deleting its data:

```bash
npm run docker:down
```

To deliberately erase all containerized VTT data and start fresh:

```bash
npm run docker:reset
```

Set `VTT_PORT` to use a different host port, for example
`VTT_PORT=8080 docker compose up`. Set `PORT` inside a custom container
deployment to change the listening port. The supplied Compose configuration is
intended for local or private self-hosting; put a TLS reverse proxy in front of
it before exposing it to the public internet.

For your own Cloudflare deployment, copy `wrangler.example.jsonc` to an ignored `wrangler.production.jsonc`, create the named D1 and R2 resources, and replace the example D1 identifier. Production credentials and campaign data must remain outside source control.

## Creative integrations

Keepers create a scoped token in **Creative imports**. The CLI can export campaign context, validate a package, submit it to the staging inbox, upload generated media, and check review status. The same token connects Codex or another Streamable HTTP MCP client to `https://what-dream-below-vtt.friarpuck.com/mcp`.

```bash
npm run vtt -- help
```

See [MCP setup](docs/MCP.md), [Content API](docs/CONTENT_API.md), [Architecture](docs/ARCHITECTURE.md), the [Codex skill](integrations/codex-skill/SKILL.md), and the [example pack](examples/content-packs/empty-platform.json).

## Contributing

The repository includes a repeatable local and GitHub Actions quality gate covering formatting, linting, TypeScript, tests, and the production Worker build. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project status

The application is under active development and currently tailored to a private 1920s Los Angeles investigative-horror campaign. The integration architecture and VTT engine are being prepared for a broader open-source release. Do not add proprietary rulebook text or artwork to the repository.

Released under the [MIT License](LICENSE).
