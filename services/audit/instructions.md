# services/audit

## Scope
- Covers the Go audit consumer service under `services/audit/`.

## Architecture Design
- The service consumes `caracal.audit.events`, persists append-only audit rows, manages tamper-evident chain state, and exports/retains partitions.
- Health, readiness, and metrics are served on port 9090.
- PostgreSQL is the durable ledger; Redis is the stream source and DLQ substrate.

## Required
- Must use Go 1.26 and `packages/core/go` for shared config, logging, audit, and crypto helpers.
- Must XACK only after insert, benign duplicate handling, or DLQ routing.
- Must leave transient PostgreSQL failures in the pending-entry list for reclaim.
- Must verify producer HMAC when configured and sign chain HMAC with the same audit key.
- Must serialize per-zone chain-head writes with advisory locks.

## Forbidden
- Must not UPDATE or DELETE `audit_events`.
- Must not store plaintext claims, tokens, credentials, or PII.
- Must not block service shutdown on exporter or retention work beyond bounded contexts.
- Must not import from `caracalEnterprise/`.

## Validation
- Validate with `go test ./services/audit/...` when audit service code changes.

