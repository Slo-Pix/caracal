# packages/revocation/go

## Scope
- Covers the Go revocation module under `packages/revocation/go/`.

## Architecture Design
- The module defines the revocation lookup interface and an in-memory implementation.

## Required
- Must use Go 1.26 and keep the module storage-neutral.
- Must keep the in-memory implementation safe for test and local use.

## Forbidden
- Must not depend on identity, transport, Redis, Postgres, or framework packages.
- Must not verify JWTs.

## Validation
- Validate with `go test ./packages/revocation/go/...` and shared Go revocation tests.

