# packages/revocation/ts

## Scope
- Covers the `@caracalai/revocation` TypeScript package under `packages/revocation/ts/`.

## Architecture Design
- The package defines the revocation lookup interface and an in-memory implementation.

## Required
- Must use TypeScript strict mode and keep exports through `src/index.ts`.
- Must keep the package dependency-free at runtime.

## Forbidden
- Must not depend on identity, transport, Redis, Postgres, or framework packages.
- Must not verify JWTs.

## Validation
- Validate with `pnpm --dir packages/revocation/ts build` and `pnpm --dir packages/revocation/ts test`.

