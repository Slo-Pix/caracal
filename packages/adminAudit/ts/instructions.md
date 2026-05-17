# packages/adminAudit/ts

## Scope
- Covers the `@caracalai/admin-audit` TypeScript package under `packages/adminAudit/ts/`.

## Architecture Design
- The package inserts normalized admin audit rows into `admin_audit_events`.
- Services pass a query-capable database object and a completed audit record.

## Required
- Must keep the public surface limited to audit record types, mutating-method constants, and insert helpers.
- Must generate audit event IDs inside the helper with UUIDv7.
- Must keep database access structural so services can pass compatible query objects.

## Forbidden
- Must not read request state, environment variables, or service config directly.
- Must not decide authorization or route ownership.
- Must not store raw secrets, tokens, or request bodies in `payload_json`.

## Validation
- Validate with `pnpm --dir packages/adminAudit/ts build` and `pnpm --dir packages/adminAudit/ts typecheck`.

