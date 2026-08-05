# Central-relay + admin-panel for cloud / Oracle Always Free (multi-arch: amd64 + arm64).
# Build context: monorepo root (see deploy/oracle/docker-compose.yml).

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/central-relay ./apps/central-relay
COPY apps/admin-panel ./apps/admin-panel

# Ignore lifecycle scripts so unused native workspace deps (better-sqlite3, etc.)
# from the lockfile cannot fail the build; rebuild only what central-relay needs.
RUN pnpm install --frozen-lockfile \
  --filter @tshirt/shared-types \
  --filter @tshirt/central-relay \
  --filter @tshirt/admin-panel \
  --ignore-scripts \
  && pnpm rebuild bcrypt sharp

RUN pnpm --filter @tshirt/shared-types build
RUN pnpm --filter @tshirt/central-relay build
# Same-origin API (empty base URL) + admin under /admin/
ENV VITE_ADMIN_BASE=/admin/
ENV VITE_CENTRAL_RELAY_URL=
RUN pnpm --filter @tshirt/admin-panel build
RUN pnpm --filter @tshirt/central-relay deploy --prod --legacy /out/central-relay
RUN cp -r apps/central-relay/drizzle /out/central-relay/drizzle \
  && mkdir -p /out/central-relay/admin-dist \
  && cp -r apps/admin-panel/dist/. /out/central-relay/admin-dist/

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=8000
ENV MIGRATE_ON_START=1
ENV SEED_ON_START=1
ENV ADMIN_DIST_PATH=/app/admin-dist
WORKDIR /app
COPY --from=build /out/central-relay ./
# Catalog/fonts uploads persist here when a volume is mounted at /app/data
RUN mkdir -p /app/data
EXPOSE 8000
CMD ["node", "dist/index.js"]
