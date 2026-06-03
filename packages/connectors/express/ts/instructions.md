# packages/connectors/express/ts

## Scope
- Covers the `@caracalai/mcp-express` TypeScript package under `packages/connectors/express/ts/`.

## Architecture Design
- The package adapts `@caracalai/transport-mcp` authentication results to Express `RequestHandler` middleware.
- Express is a peer dependency; Caracal auth logic stays in transport and SDK packages.

## Required
- Must map transport authentication errors to HTTP responses through `httpStatusForAuthError` from `@caracalai/transport-mcp`; never re-derive status codes locally.
- Must require caller-provided revocation behavior through middleware options.
- Must keep Express request augmentation minimal and typed.

## Forbidden
- Must not reimplement JWT verification, JWKS fetching, revocation lookup, or token exchange.
- Must not depend on FastMCP, Go net/http, Redis, or Postgres.
- Must not pass unauthenticated requests to downstream handlers.

## Validation
- Validate with `pnpm --dir packages/connectors/express/ts build` and its connector tests.

