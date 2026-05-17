# packages/identity

## Scope
- Covers per-language identity packages under `packages/identity/`.

## Architecture Design
- Identity packages own JWT verification, JWKS retrieval/caching, scope evaluation, and claim shapes.
- Transport, framework, runtime, and storage adapters consume identity; they do not live here.

## Required
- Must keep each language implementation in its own child directory.
- Must keep language surfaces conceptually aligned for verification, JWKS, scope, and claims.
- Must fail closed on invalid signatures, issuers, audiences, expiry, and malformed claims.

## Forbidden
- Must not host MCP, FastMCP, Express, net/http, Redis, Postgres, or runtime adapter code.
- Must not import from `caracalEnterprise/`.

## Validation
- Validate through the touched child package and identity tests for that language.

