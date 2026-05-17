# packages/core/go

## Scope
- Covers the Go core module under `packages/core/go/`.

## Architecture Design
- Packages under this module provide shared audit, command catalog, config, crypto, errors, logging, metrics, scope, and STS types.
- Go services and Go library packages consume these primitives through public package paths.

## Required
- Must use Go 1.26 and keep the module path `github.com/garudex-labs/caracal/packages/core/go`.
- Must keep crypto primitives centralized in `crypto`.
- Must keep structured logging and redaction centralized in `logging`.
- Must keep command catalog parity with `packages/core/ts/src/commands.ts`.
- Must keep service-specific behavior out of core packages.

## Forbidden
- Must not import service `internal/` packages.
- Must not add platform-specific behavior outside a narrow, documented core boundary.
- Must not duplicate package behavior already owned by another core subpackage.

## Validation
- Validate with `go test ./packages/core/go/...` and command-catalog parity tests when catalog behavior changes.

