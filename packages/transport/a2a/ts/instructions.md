# packages/transport/a2a/ts

## Scope
- Covers the `@caracalai/transport-a2a` TypeScript package under `packages/transport/a2a/ts/`.

## Architecture Design
- The package provides A2A subject-token preservation, scope subset enforcement, and message envelope behavior.
- It consumes OAuth and SDK primitives through public package surfaces.

## Required
- Must use TypeScript strict mode and keep exports through `src/index.ts`.
- Must prevent scope escalation across agent-to-agent hops.
- Must preserve subject identity and delegation context in envelopes.

## Forbidden
- Must not import agent runtime implementations, framework SDKs, storage backends, or service internals.
- Must not log plaintext tokens.

## Validation
- Validate with `pnpm --dir packages/transport/a2a/ts build` and `pnpm --dir packages/transport/a2a/ts test`.

