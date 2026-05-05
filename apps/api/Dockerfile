# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# API service image; build context must be the caracal/ workspace root.
FROM node:24-alpine AS builder
WORKDIR /app
COPY apps/api/package.json ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY apps/api/package.json ./
COPY infra/postgres/migrations /caracal/migrations
ENV CARACAL_MIGRATIONS_DIR=/caracal/migrations
USER node
CMD ["node", "dist/main.js"]
