# packages/connectors/fastmcp/ts

## Scope
- Covers the `@caracalai/mcp-fastmcp` TypeScript package under `packages/connectors/fastmcp/ts/`.

## Architecture Design
- The package adapts `@caracalai/transport-mcp` authentication to FastMCP token-validation hooks.

## Required
- Must call `@caracalai/transport-mcp` for token authentication.
- Must keep FastMCP request shaping local to this package.
- Must keep exported types usable without importing app or service code.

## Forbidden
- Must not import `jose` or implement JWT verification directly.
- Must not depend on Express, Go net/http, Redis, or Postgres.
- Must not pass unauthenticated requests to FastMCP handlers.

## Validation
- Validate with `pnpm --dir packages/connectors/fastmcp/ts build` and its connector tests.

