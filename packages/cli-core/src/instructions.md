# cli-core/src

## Scope
- Covers verb-body source modules under `packages/cli-core/src/`.

## Required
- Each module groups one CLI noun's verbs (e.g. `zone.ts`, `app.ts`).
- Module-internal helpers must stay private; only verb functions and shared types may be re-exported through `index.ts`.
- Every source file must begin with the project file header.

## Forbidden
- Must not contain CLI flag parsing or terminal printing.
- Must not import from `apps/`.
