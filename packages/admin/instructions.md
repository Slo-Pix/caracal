# packages/admin

## Scope
- Covers admin API client package grouping under `packages/admin/`.

## Architecture Design
- Language implementations live in child directories.
- The current implementation is TypeScript-only under `ts/`.

## Required
- Must keep implementation code inside language subdirectories.
- Must keep admin clients framework-agnostic and reusable by terminal, scripts, and tests.

## Forbidden
- Must not place source files at this level.
- Must not duplicate API route schemas outside the owning language package.

## Validation
- Validate through the touched child package.

