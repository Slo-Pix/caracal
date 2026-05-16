# transport/a2a

## Scope
- Covers the agent-to-agent transport primitives grouped by language.
- TypeScript (`ts/`) is the only supported A2A binding.

## Required
- Each child directory must implement the A2A protocol contract for one language.
- New host integrations must consume A2A through `ts/` or relay over the coordinator.

## Forbidden
- Must not contain runtime or framework adapter code.
- Must not add a Go or Python A2A binding without coordinator-team approval.
