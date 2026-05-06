# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# API service image; build context must be the caracal/ workspace root.
FROM node:24-alpine AS builder
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN npm install -g pnpm && pnpm install --frozen-lockfile --filter @caracalai/api...
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
RUN pnpm --filter @caracalai/api build && pnpm --filter @caracalai/api deploy --prod --legacy /out

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /out ./
COPY infra/postgres/migrations /caracal/migrations
ENV CARACAL_MIGRATIONS_DIR=/caracal/migrations
USER node
CMD ["node", "dist/main.js"]
