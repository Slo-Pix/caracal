# services/control

## Scope
- Covers the Go control invocation service under `services/control/`.

## Architecture Design
- `cmd/control/main.go` is the startup boundary and requires explicit enablement.
- `internal/handler.go` exposes control invocation plus health and readiness endpoints.
- The command catalog in `packages/core/go/commands` is the canonical allowlist for accepted commands.

## Required
- Must use Go 1.26 and `packages/core/go` plus `packages/identity/go` for shared behavior.
- Must refuse startup unless `CARACAL_CONTROL_ENABLED=true`.
- Must expose only `POST /v1/control/invoke`, `/health`, and `/ready`.
- Must validate command and subcommand before any upstream call.
- Must audit every accepted and rejected request to `caracal.audit.events`.
- Must require ES256 bearer JWTs with the `control:invoke` scope.

## Forbidden
- Must not shell out, fork, exec, or run local commands.
- Must not accept commands absent from the canonical catalog.
- Must not add admin endpoints or extra control routes.
- Must not bind to a host port already used by another OSS service.

## Validation
- Validate with `go test ./services/control/...` when control service code changes.

