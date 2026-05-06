# services

## Scope
- Covers only Go microservices under this directory.

## Required
- Must contain only Go services, each with its own `go.mod`.
- Must use `go.work` at the `caracal/` root for inter-module resolution.
- Must name directories by service identity (e.g. `sts`, `gateway`, `audit`).

## Forbidden
- Must not contain TypeScript apps or packages.
- Must not contain infra configuration (Docker, SQL, Redis config).
- Must not place shared library code here; shared Go code belongs in `packages/shared/`.
