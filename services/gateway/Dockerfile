# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Gateway service image; build context must be the caracal/ workspace root.

FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY packages/shared/ packages/shared/
COPY packages/caracalai-mcp-go/ packages/caracalai-mcp-go/
COPY services/sts/ services/sts/
COPY services/audit/ services/audit/
COPY apps/agent-coordinator/relay/ apps/agent-coordinator/relay/
COPY services/gateway/ services/gateway/
COPY tests/go/ tests/go/
WORKDIR /build/services/gateway
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o /gateway ./cmd/gateway

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /gateway /gateway
USER 65532:65532
ENTRYPOINT ["/gateway"]
