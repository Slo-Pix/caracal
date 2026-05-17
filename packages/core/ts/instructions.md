# packages/core/ts

## Scope
- Covers the `@caracalai/core` TypeScript package under `packages/core/ts/`.

## Architecture Design
- The package provides TypeScript config, errors, logging, audit, crypto, env, JSON, metrics, scope, URL, and command-catalog primitives.
- It is the shared foundation for TypeScript apps and packages.

## Required
- Must use TypeScript strict mode and NodeNext module resolution.
- Must keep `src/index.ts` as the public export surface.
- Must emit structured JSON logs to stderr.
- Must keep command catalog changes aligned with the Go mirror.

## Forbidden
- Must not add service-specific or app-specific logic.
- Must not introduce runtime dependencies without updating package metadata and this instruction file.
- Must not log raw secrets or tokens.

## Validation
- Validate with `pnpm --dir packages/core/ts build`, `pnpm --dir packages/core/ts test`, and catalog parity tests when command data changes.

