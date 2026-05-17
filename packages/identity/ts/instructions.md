# packages/identity/ts

## Scope
- Covers the `@caracalai/identity` TypeScript package under `packages/identity/ts/`.

## Architecture Design
- The package verifies Caracal JWTs, fetches/caches JWKS, evaluates scopes, and exposes typed claims.
- It depends on `@caracalai/core` and `jose`.

## Required
- Must use TypeScript strict mode and the package export surface in `src/index.ts`.
- Must keep verification framework-neutral and storage-neutral.
- Must fail closed for invalid issuer, audience, expiry, scope, signature, and malformed claims.

## Forbidden
- Must not depend on Express, FastMCP, MCP transport, Redis, Postgres, or service internals.
- Must not log raw tokens or claims.
- Must not import from `caracalEnterprise/`.

## Validation
- Validate with `pnpm --dir packages/identity/ts build` and `pnpm --dir packages/identity/ts test`.

