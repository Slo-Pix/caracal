# infra/secrets

## Scope
- Covers local development secret generation under `infra/secrets/`.

## Architecture Design
- `secretInit.mjs` creates file-backed Compose secrets under `files/` for local development only.
- Production deployments must provide secrets from an external manager.

## Required
- Must generate secret material with Node cryptographic randomness.
- Must keep `files/` gitignored and host-readable only by the local owner.
- Must keep generated filenames aligned with Compose secret declarations.
- Must support repeatable local initialization without printing secret values.

## Forbidden
- Must not commit generated files from `files/`.
- Must not bake secrets into images or manifests.
- Must not log, echo, snapshot, or test-assert raw secret values.

## Validation
- Validate with `pnpm secrets:init` after changing secret names or generation behavior.

