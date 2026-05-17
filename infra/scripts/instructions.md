# infra/scripts

## Scope
- Covers operator scripts for validating the local infrastructure stack under `infra/scripts/`.

## Architecture Design
- Scripts in this directory probe running OSS services and support CI or local stack gates.

## Required
- Must keep scripts executable, fail-fast, and runnable from the repository root.
- Must default local probes to loopback addresses unless explicitly configured otherwise.
- Must exit non-zero on the first failed health or readiness gate.

## Forbidden
- Must not store credentials or echo secret values.
- Must not bypass health gates with success-shaped fallbacks.
- Must not mutate service data while performing smoke checks.

## Validation
- Validate script edits by running the touched script against a running local stack or with shell syntax checks.

