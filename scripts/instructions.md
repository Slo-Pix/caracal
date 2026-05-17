# scripts

## Scope
- Covers repository-level automation under `scripts/`.

## Architecture Design
- Root scripts orchestrate release, publish, CI, and post-release validation workflows.
- Shared shell presentation and selection helpers live under `scripts/lib/`.
- Published-artifact checks live under `scripts/postRelease/`.

## Required
- Must keep scripts executable, fail-fast, and runnable from the repository root.
- Must reuse `pnpm`, Go, Python, and package-manager commands already declared by the workspace.
- Must keep release and publish scripts deterministic and registry-explicit.

## Forbidden
- Must not embed secrets, tokens, or registry credentials.
- Must not duplicate complex package logic that belongs in package scripts.
- Must not mutate generated release findings outside the owning post-release workflow.

## Validation
- Validate touched scripts with shell syntax checks and the narrow workflow command they wrap.

