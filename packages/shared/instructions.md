# caracal/packages/shared

## Scope
- Covers the cross-cutting Go module shared by every OSS service under caracal/packages/shared/.

## Required
- Go packages (`config`, `errors`, `crypto`, `logging`) live directly in this directory under the module `github.com/garudex-labs/caracal/shared`.
- TypeScript utilities live in `caracal/packages/ts-shared/` as the `@caracalai/shared` package.
- Every Go service must import only from `github.com/garudex-labs/caracal/shared/*`.
- Every TypeScript service must import shared utilities from `@caracalai/shared`.
- `crypto` package must wrap ChaCha20-Poly1305 and ECDSA P-256 primitives only; no raw cipher usage outside this package.
- `logging` package must produce structured JSON on stderr; no plaintext log lines elsewhere.

## Forbidden
- Must not import or reference `caracalEnterprise/`.
- Must not add platform-specific dependencies to the shared layer.
- Must not embed service-specific business logic.
- Must not add packages beyond config, errors, crypto, and logging without updating this file.
