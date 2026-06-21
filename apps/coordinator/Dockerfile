# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Coordinator image; build context must be the caracal/ workspace root.

# syntax=docker/dockerfile:1.7
ARG PNPM_VERSION=11.1.1

FROM node:26-alpine@sha256:a2dc166a387cc6ca1e62d0c8e265e49ca985d6e60abc9fe6e6c3d6ce8e63f606 AS node-builder
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/coordinator/package.json apps/coordinator/package.json
COPY packages/adminAudit/ts/package.json packages/adminAudit/ts/package.json
COPY packages/core/ts/package.json packages/core/ts/package.json
COPY packages/identity/ts/package.json packages/identity/ts/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts --filter @caracalai/coordinator...
COPY packages/adminAudit/ts/tsconfig.json packages/adminAudit/ts/tsconfig.json
COPY packages/adminAudit/ts/src packages/adminAudit/ts/src
COPY packages/core/ts/tsconfig.json packages/core/ts/tsconfig.json
COPY packages/core/ts/src packages/core/ts/src
COPY packages/identity/ts/tsconfig.json packages/identity/ts/tsconfig.json
COPY packages/identity/ts/src packages/identity/ts/src
COPY apps/coordinator/tsconfig.json apps/coordinator/tsconfig.json
COPY apps/coordinator/src/ apps/coordinator/src/
RUN set -e; \
    pnpm --filter @caracalai/admin-audit build; \
    pnpm --filter @caracalai/core build; \
    pnpm --filter @caracalai/identity build; \
    pnpm --filter @caracalai/coordinator build; \
    pnpm --config.inject-workspace-packages=true --filter @caracalai/coordinator deploy --prod /out; \
    find /out/node_modules -type d \( -name test -o -name tests -o -name __tests__ \) -prune -exec rm -rf {} + 2>/dev/null || true; \
    find /out/node_modules -type f \( -name '*.md' -o -name '*.markdown' -o -name '*.map' -o -name 'CHANGELOG*' -o -name '.npmignore' -o -name '.eslintrc*' -o -name '.prettierrc*' \) -delete 2>/dev/null || true

FROM node:26-alpine@sha256:a2dc166a387cc6ca1e62d0c8e265e49ca985d6e60abc9fe6e6c3d6ce8e63f606
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PORT=4000
WORKDIR /app
COPY --from=node-builder --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/ready" || exit 1
ENTRYPOINT ["node", "/app/dist/main.js"]
