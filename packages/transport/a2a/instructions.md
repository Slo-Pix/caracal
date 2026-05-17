# packages/transport/a2a

## Scope
- Covers agent-to-agent transport package grouping under `packages/transport/a2a/`.

## Architecture Design
- The current implementation is TypeScript-only under `ts/`.
- A2A primitives preserve subject-token context and constrain delegated scope across hops.

## Required
- Must keep protocol behavior reusable by services, SDKs, and agent runtimes.
- Must keep language implementations in child directories.
- Must route token exchange through the OAuth package.

## Forbidden
- Must not host framework adapters or storage backends.
- Must not add Go or Python A2A bindings without adding full package, tests, and workspace wiring.

## Validation
- Validate through the touched child package.

