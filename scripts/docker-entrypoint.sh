#!/bin/sh
set -eu

PERSISTENCE_DIRECTORY="${VTT_DATA_DIRECTORY:-/data}"

mkdir -p "$PERSISTENCE_DIRECTORY"

echo "Applying local D1 migrations..."
npx wrangler d1 migrations apply what-dreams-below-vtt-local \
  --local \
  --persist-to "$PERSISTENCE_DIRECTORY" \
  --config wrangler.docker.jsonc

echo "Starting What Dreams Below VTT on port ${PORT:-3000}..."
exec npx wrangler dev \
  --local \
  --ip 0.0.0.0 \
  --port "${PORT:-3000}" \
  --persist-to "$PERSISTENCE_DIRECTORY" \
  --config wrangler.docker.jsonc

