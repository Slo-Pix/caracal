# packages/identity/go

## Scope
- Covers the Go identity module under `packages/identity/go/`.

## Architecture Design
- The module verifies Caracal JWTs, fetches/caches JWKS, evaluates scopes, and exposes typed claims.

## Required
- Must use Go 1.26 and `github.com/golang-jwt/jwt/v5`.
- Must keep JWT verification and JWKS caching framework-neutral.
- Must expose typed errors and claims suitable for services and transports.

## Forbidden
- Must not depend on net/http middleware, MCP, FastMCP, Redis, Postgres, or service internals.
- Must not accept unsigned or weakly signed tokens.
- Must not import from `caracalEnterprise/`.

## Validation
- Validate with `go test ./packages/identity/go/...` and shared Go identity tests.

