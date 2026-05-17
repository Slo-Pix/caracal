# packages/sdk/go

## Scope
- Covers the Go SDK module under `packages/sdk/go/`.

## Architecture Design
- The module exposes `Caracal` as the drop-in API plus context, coordinator, envelope, HTTP, primitive, and lifecycle-hook helpers.
- Go convention keeps advanced and drop-in surfaces in one package.

## Required
- Must use Go 1.26 and consume token exchange through `packages/oauth/go`.
- Must preserve ambient context propagation and delegation envelope behavior.
- Must keep HTTP helpers framework-neutral.

## Forbidden
- Must not implement STS policy evaluation or identity verification internals.
- Must not depend on services, apps, or connector siblings.
- Must not log or persist bearer tokens.

## Validation
- Validate with `go test ./packages/sdk/go/...`.

