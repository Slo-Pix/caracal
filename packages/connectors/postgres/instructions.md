# packages/connectors/postgres

## Scope
- Covers Postgres-backed connector package grouping under `packages/connectors/postgres/`.

## Architecture Design
- The current implementation is TypeScript-only under `ts/`.
- Postgres connectors implement persistence-backed state, not transport or request authentication.

## Required
- Must keep Postgres-specific behavior inside language subdirectories.
- Must keep token-state persistence separate from revocation and transport packages.

## Forbidden
- Must not host JWT verification, framework middleware, or generic transport logic.
- Must not add non-Postgres storage adapters here.

## Validation
- Validate through the touched child package.

