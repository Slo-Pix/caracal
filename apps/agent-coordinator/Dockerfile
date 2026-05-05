# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Agent coordinator image; build context must be the caracal/ workspace root.

FROM golang:1.26-alpine AS go-builder
WORKDIR /build
COPY go.work go.work
COPY packages/shared/ packages/shared/
COPY packages/caracalai-mcp-go/ packages/caracalai-mcp-go/
COPY services/sts/ services/sts/
COPY services/audit/ services/audit/
COPY services/gateway/ services/gateway/
COPY apps/agent-coordinator/relay/ apps/agent-coordinator/relay/
COPY tests/go/ tests/go/
WORKDIR /build/apps/agent-coordinator/relay
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o /relay ./cmd/relay

FROM node:24-alpine AS node-builder
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent-coordinator/package.json apps/agent-coordinator/package.json
RUN npm install -g pnpm && pnpm install --frozen-lockfile --filter @caracalai/agent-coordinator...
COPY apps/agent-coordinator/tsconfig.json apps/agent-coordinator/tsconfig.json
COPY apps/agent-coordinator/src/ apps/agent-coordinator/src/
RUN pnpm --filter @caracalai/agent-coordinator build && pnpm --filter @caracalai/agent-coordinator deploy --prod --legacy /out

FROM node:24-alpine
WORKDIR /app
COPY --from=go-builder /relay /relay
COPY --from=node-builder /out ./
COPY apps/agent-coordinator/start.sh /start.sh
RUN chmod +x /start.sh && chown -R node:node /app /relay /start.sh
USER node
ENTRYPOINT ["/start.sh"]
