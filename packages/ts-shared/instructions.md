# caracal/shared/ts

## Scope
- Covers only the `@caracalai/shared` TypeScript package under `caracal/shared/ts/`.

## Required
- Must export only config, errors, and logging from `src/index.ts`.
- Must use TypeScript strict mode and NodeNext module resolution.
- Must emit structured JSON logs to stderr only.

## Forbidden
- Must not import or reference `caracalEnterprise/`.
- Must not add runtime npm dependencies without updating this file.
- Must not add service-specific logic to this package.
