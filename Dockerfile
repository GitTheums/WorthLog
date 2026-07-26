# syntax=docker/dockerfile:1

# Multi-stage production image for amd64 and arm64.
# better-sqlite3 is compiled in the build/prod-deps stages (python3/make/g++)
# so Buildx rebuilds the native addon per target platform.
# Persistent SQLite data lives at /app/data and is never copied into the image.

# -----------------------------------------------------------------------------
# Build stage: compile the React client and TypeScript server (better-sqlite3)
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

COPY client ./client
COPY server ./server

RUN npm run build -w client \
  && npm run build -w server

# -----------------------------------------------------------------------------
# Production dependencies only (server runtime + native better-sqlite3)
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS prod-deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install production deps for the server workspace (hoisted to /app/node_modules).
RUN npm ci --omit=dev -w server \
  && npm cache clean --force

# -----------------------------------------------------------------------------
# Runtime image
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

# OCI labels are primarily set by the publish workflow (docker/metadata-action).
# Defaults here help local builds remain identifiable.
LABEL org.opencontainers.image.title="WorthLog" \
  org.opencontainers.image.description="Self-hosted investment value logging application" \
  org.opencontainers.image.source="https://github.com/GitTheums/WorthLog"

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    CLIENT_DIST_DIR=/app/client/dist

WORKDIR /app

COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# Persist SQLite here; host bind mounts should be owned by UID 1000 (node).
# Do not COPY any database files — ./data is excluded via .dockerignore.
RUN mkdir -p /app/data \
  && chown -R node:node /app/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/dist/index.js"]
