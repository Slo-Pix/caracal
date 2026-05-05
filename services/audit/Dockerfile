# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Audit service image; build context must be the caracal/ workspace root.

FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY packages/shared/ packages/shared/
COPY packages/caracalai-mcp-go/ packages/caracalai-mcp-go/
COPY services/sts/ services/sts/
COPY services/gateway/ services/gateway/
COPY apps/agent-coordinator/relay/ apps/agent-coordinator/relay/
COPY services/audit/ services/audit/
COPY tests/go/ tests/go/
WORKDIR /build/services/audit
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o /audit ./cmd/audit

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /audit /audit
USER 65532:65532
ENTRYPOINT ["/audit"]
