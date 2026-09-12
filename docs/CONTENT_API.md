# Content API

The Content API lets trusted creative tools read a deliberately limited campaign brief and submit validated content for Keeper review. It is provider-neutral and uses ordinary JSON over HTTPS.

## Authentication

Create a token under **Keeper → Creative imports**. Tokens are scoped to one campaign, stored as SHA-256 hashes, displayed once, and revocable. Send the token as a bearer credential:

```http
Authorization: Bearer wdb_...
```

Current scopes are `context:read`, `imports:write`, and `assets:write`. Tokens cannot approve imports or alter the live board.

## Endpoints

- `GET /api/v1/campaigns/{campaignId}/context` returns a creative brief without credentials, private player notes, or authentication data.
- `GET /api/v1/campaigns/{campaignId}/imports` lists staged imports.
- `POST /api/v1/campaigns/{campaignId}/imports` validates and stages a version 1.0 package.
- `GET /api/v1/campaigns/{campaignId}/assets` lists generated media and review status.
- `POST /api/v1/campaigns/{campaignId}/assets` accepts a multipart image upload or an HTTPS `sourceUrl` for Keeper review.
- `GET /api/v1/openapi` returns the OpenAPI 3.1 description.

The package contract is defined in `lib/content-schema.ts`. Invalid packages receive HTTP 422 with field-level validation messages.

## CLI quick start

```bash
export WDB_VTT_TOKEN='token-shown-by-the-keeper-dashboard'
npm run vtt -- configure --campaign campaign-id
npm run vtt -- context --out campaign-context.json
npm run vtt -- validate examples/content-packs/empty-platform.json
npm run vtt -- submit examples/content-packs/empty-platform.json
npm run vtt -- upload generated-map.png --kind map --name "Echo Park boathouse"
npm run vtt -- assets
```

Use the environment variable in automation so secrets do not enter shell history or repository files.

## Approval semantics

Submitting returns HTTP 202. It does not mutate the campaign. Approval in the Keeper staging inbox creates scenes, NPCs/MOBs, and handouts. Encounter briefs are recorded in the campaign log. Generated media is not publicly readable until approved. Deleting media removes both its metadata and R2 object.

## Media safeguards

Uploads accept PNG, JPEG, WebP, and GIF files up to 12 MB. Remote imports require HTTPS, reject local addresses, re-check redirected destinations, and enforce the byte limit while reading. R2 objects use opaque IDs and campaign-prefixed keys.
