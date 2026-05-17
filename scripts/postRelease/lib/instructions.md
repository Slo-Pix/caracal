# scripts/postRelease/lib

## Scope
- Covers shared helpers sourced by post-release validation scripts.

## Architecture Design
- Helpers centralize finding emission, severity/status constants, filtering, and common release environment handling.

## Required
- Must operate through `CARACAL_VERSION`, `FINDINGS_DIR`, `DRY_RUN`, and `ONLY`.
- Must keep helper functions additive and reusable by sibling validators.
- Must keep JSONL output stable for `aggregateReport.ts`.

## Forbidden
- Must not perform artifact-specific validation in this library.
- Must not shadow POSIX builtins.
- Must not create persistent files outside `FINDINGS_DIR`.

## Validation
- Validate helper edits by running at least one validator that sources `lib/common.sh`.

