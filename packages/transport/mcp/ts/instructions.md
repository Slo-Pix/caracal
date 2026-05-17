# packages/transport/mcp/ts

## Scope
- Covers the `@caracalai/transport-mcp` TypeScript package under `packages/transport/mcp/ts/`.

## Architecture Design
- The package authenticates Caracal JWTs with `@caracalai/identity` and checks revocation through `@caracalai/revocation`.

## Required
- Must use TypeScript strict mode and expose a transport-neutral `authenticate` result.
- Must require caller-provided revocation behavior for every authenticated session.
- Must keep auth errors typed for connector mapping.

## Forbidden
- Must not depend on Express, FastMCP, Go net/http, Redis, Postgres, or service internals.
- Must not perform storage lookups except through the revocation interface.
- Must not log plaintext tokens.

## Validation
- Validate with `pnpm --dir packages/transport/mcp/ts build` and `pnpm --dir packages/transport/mcp/ts test`.
