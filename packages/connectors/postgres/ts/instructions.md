# packages/connectors/postgres/ts

## Scope
- Covers the `@caracalai/tokenstate-postgres` TypeScript package under `packages/connectors/postgres/ts/`.

## Architecture Design
- The package persists per-subject MCP token state in PostgreSQL through the `pg` driver.

## Required
- Must keep database access explicit and Postgres-only.
- Must keep stored token-state fields limited to the package contract.
- Must let callers own connection lifecycle and deployment configuration.

## Forbidden
- Must not implement revocation interfaces, JWT verification, or framework middleware.
- Must not import identity, transport, SDK, Redis, Express, or FastMCP packages.
- Must not store plaintext bearer tokens.

## Validation
- Validate with `pnpm --dir packages/connectors/postgres/ts build` and its connector tests.

