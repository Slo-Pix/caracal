# packages/oauth/go

## Scope
- Covers the Go OAuth token-exchange module under `packages/oauth/go/`.

## Architecture Design
- The module provides RFC 8693 exchange client types, response types, and in-memory cache behavior for Go SDK consumers.

## Required
- Must use Go 1.26 and keep the module path `github.com/garudex-labs/caracal/packages/oauth/go`.
- Must keep token caching in memory and scoped by subject token context.
- Must surface interaction-required and exchange failures as typed Go errors or results.

## Forbidden
- Must not persist tokens to disk.
- Must not depend on identity, revocation, transport, framework, or service modules.
- Must not proactively refresh tokens without a caller exchange request.

## Validation
- Validate with `go test ./packages/oauth/go/...`.

