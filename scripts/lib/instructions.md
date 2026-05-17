# scripts/lib

## Scope
- Covers shared shell helpers under `scripts/lib/`.

## Architecture Design
- Helpers provide reusable terminal style and selection primitives for root automation scripts.

## Required
- Must keep helpers sourceable by POSIX-compatible shell scripts that opt into them.
- Must keep function names short, explicit, and non-conflicting with shell builtins.
- Must avoid side effects at source time except defining constants and functions.

## Forbidden
- Must not execute release, publish, test, or validation workflows directly.
- Must not read secrets or mutate the working tree.
- Must not introduce stateful globals beyond presentation constants.

## Validation
- Validate with `bash -n` on touched helper files and scripts that source them.

