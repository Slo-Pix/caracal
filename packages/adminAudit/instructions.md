# packages/adminAudit

## Scope
- Covers internal admin-audit package grouping under `packages/adminAudit/`.

## Architecture Design
- The current implementation is TypeScript-only under `ts/`.
- This package is an internal persistence helper used by admin-facing services.

## Required
- Must keep implementation code inside language subdirectories.
- Must keep admin-audit helpers narrow and persistence-focused.

## Forbidden
- Must not expose a public SDK surface from this level.
- Must not own API route auth, request handling, or audit policy.

## Validation
- Validate through the touched child package.

