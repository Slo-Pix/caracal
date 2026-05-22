# infra/docker

## Scope
- Covers Docker and Docker Compose orchestration under `infra/docker/`.

## Architecture Design
- `docker-compose.yml` is the local development stack using local images and repo paths.
- `runtime-compose.yml` is the self-hosted runtime stack using versioned GHCR images.
- `dev.env` is committed and rendered from `packages/engine/src/envSchema.ts`; never edit by hand.
- `local.env` is gitignored and holds operator overrides. Compose loads `dev.env` first, then `local.env`, so local entries win.
- Service Dockerfiles remain with their owning service or app unless shared Go-service packaging is required.

## Required
- Must keep runtime-managed local images tagged as `localhost/caracal-*:${CARACAL_DEV_VERSION}` using `<base>-dev.sha<gitsha>`.
- Must keep runtime images pinned to `v${CARACAL_VERSION}` through `CARACAL_REGISTRY`.
- Must keep healthchecks on long-running services and gate startup with `service_healthy` or `service_completed_successfully`.
- Must source secrets through Compose secrets, never inline environment literals.
- Must preserve OSS host ports: 3000, 4000, 5432, 6379, 8080, 8081, 8087, and 9090.
- Must regenerate `dev.env` via `node packages/engine/scripts/render-dev-env.mjs` after every schema change.

## Forbidden
- Must not use floating release tags for runtime images.
- Must not make local development pull GHCR images.
- Must not run application containers as root or bake secrets into images.
- Must not bind the same host port twice.
- Must not commit `local.env` or any file containing secret strings.
- Must not edit `dev.env` by hand; edit `packages/engine/src/envSchema.ts` and re-render.

## Validation
- Validate Compose edits with `docker compose --env-file infra/docker/dev.env -f infra/docker/docker-compose.yml config`.
- Run `node packages/engine/scripts/render-dev-env.mjs --check` to detect schema drift.
