# syntax=docker/dockerfile:1
# ── Horizons CRM · API ─────────────────────────────────────────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.15.1 && apt-get update && apt-get install -y --no-install-recommends wget openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Dependências (camada em cache enquanto os manifests não mudam)
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @horizons/api...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @horizons/api db:generate && pnpm --filter @horizons/api build

# Runtime: usuário sem privilégios; o CLI do Prisma é mantido para aplicar migrations no start.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
WORKDIR /app/apps/api
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3333
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
