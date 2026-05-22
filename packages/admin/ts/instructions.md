# packages/admin/ts

## Scope
- Covers the `@caracalai/admin` TypeScript package under `packages/admin/ts/`.

## Architecture Design
- `AdminClient` is the typed HTTP wrapper for the control-plane API and coordinator API.
- Callers provide URLs and tokens explicitly; this package performs no environment or disk discovery.

## Required
- Must use the platform `fetch` API.
- Must surface non-2xx responses as `AdminApiError` with status, code, and body.
- Must keep exported types stable for app, terminal, script, and test consumers.
- Must remain framework-agnostic.

## Forbidden
- Must not read environment variables, config files, or credentials from disk.
- Must not embed tokens, generated secrets, or default credentials.
- Must not introduce heavy HTTP clients or runtime schema libraries.

## Validation
- Validate with `pnpm --dir packages/admin/ts build` and `pnpm --dir packages/admin/ts test` when admin client code changes.

