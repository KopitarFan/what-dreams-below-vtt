# syntax=docker/dockerfile:1

FROM node:22.20.0-bookworm-slim AS application

ENV NODE_ENV=production \
    WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts && \
    npm cache clean --force

COPY . .
RUN npm run build && chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
