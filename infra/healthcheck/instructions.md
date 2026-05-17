# infra/healthcheck

## Scope
- Covers the reusable Go healthcheck binary under `infra/healthcheck/`.

## Architecture Design
- The binary performs one HTTP probe against `HEALTH_HOST`, `PORT`, and `HEALTH_PATH`.
- Container images use it for liveness or readiness without embedding service-specific logic.

## Required
- Must stay dependency-free apart from the Go standard library.
- Must default to `127.0.0.1`, port `8080`, path `/ready`, and a short timeout.
- Must exit non-zero on transport errors or non-2xx/3xx responses.

## Forbidden
- Must not import service packages or know about individual service routes beyond environment-selected paths.
- Must not log secrets, request headers, or response bodies.
- Must not retry indefinitely.

## Validation
- Validate with `go test ./infra/healthcheck` when this binary changes.

