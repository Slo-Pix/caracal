# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Gateway service image; build context must be the caracal/ workspace root.

FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY packages/shared/ packages/shared/
COPY services/gateway/ services/gateway/
WORKDIR /build/services/gateway
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o /gateway ./cmd/gateway

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /gateway /gateway
USER nonroot:nonroot
ENTRYPOINT ["/gateway"]
