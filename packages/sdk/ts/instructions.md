# packages/sdk/ts

## Scope
- Covers the `@caracalai/sdk` TypeScript package under `packages/sdk/ts/`.

## Architecture Design
- The package exposes `Caracal`, advanced surfaces, context, coordinator, envelope, HTTP, JSON, and primitive helpers.
- It consumes OAuth token exchange through `@caracalai/oauth`.

## Required
- Must use TypeScript strict mode and keep exports through `src/index.ts` and `src/advanced.ts`.
- Must preserve context propagation, delegation constraints, envelope semantics, and lifecycle hook behavior.
- Must keep HTTP helpers framework-neutral.

## Forbidden
- Must not implement STS policy evaluation, revocation storage, or JWT verification internals.
- Must not depend on apps, services, or connector siblings.
- Must not log or persist bearer tokens.

## Validation
- Validate with `pnpm --dir packages/sdk/ts build` and `pnpm --dir packages/sdk/ts test`.
