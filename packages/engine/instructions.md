# packages/engine

## Scope
- Covers the `@caracalai/engine` TypeScript package under `packages/engine/`.

## Architecture Design
- Engine owns non-HTTP execution used by CLI and TUI: stack lifecycle, runtime asset provisioning, process execution, credential reads, control invocation, OAuth step-up, token scrubbing, and crash-safe helpers.
- `@caracalai/admin` owns admin HTTP calls.
- `src/embedded.ts` is generated from runtime assets by `scripts/build-embedded.mjs`.

## Required
- Must expose pure async functions that accept typed options and return unformatted results.
- Must keep streaming APIs callback-based and disposable.
- Must generate embedded runtime assets before build and typecheck through existing scripts.
- Must scrub token-bearing strings before exposing them to callers.
- Must keep CLI/TUI-specific formatting outside this package.

## Forbidden
- Must not parse argv, print to stdout/stderr, manipulate terminal state, or call `process.exit`.
- Must not import from `apps/`.
- Must not read disk or environment state except through explicit caller-provided options.
- Must not embed credentials.

## Validation
- Validate with `pnpm --dir packages/engine build` and `pnpm --dir packages/engine typecheck`.

