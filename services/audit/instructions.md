# audit

## Scope
- Covers the audit consumer service under caracal/services/audit/ only.

## Required
- Must use Go 1.26.
- Must listen on port 9090 (health, ready, metrics) only.
- Must read and follow caracal/plan/audit/plan.md before any change; check off tasks as completed.
- Must consume from caracal.audit.events using consumer group audit-ingestor.
- Must XACK only after a terminal outcome (insert, benign duplicate, or DLQ).
- Must route parse, hmac, tamper-on-replay, permanent PG, and exceeded-delivery failures to caracal.audit.events.dlq.
- Must leave transient PG failures in the PEL for the XAutoClaim reaper.
- Must verify producer HMAC when AUDIT_HMAC_KEY is set; sign chain HMAC with the same key.
- Must serialize per-zone chain head writes via pg_advisory_xact_lock(hashtext(zone_id)).
- Must gate the parquet exporter and retention rotator on session-level pg_try_advisory_lock leases.
- Must not UPDATE or DELETE rows in audit_events.
- Must use github.com/garudex-labs/caracal/shared/* for config, errors, and logging.

## Env
- AUDIT_HMAC_KEY: hex-encoded >=32-byte key for chain HMAC and producer signature verification.
- AUDIT_RETENTION_DAYS: monthly partitions whose end is <= now-N days are dropped (default 365).
- AUDIT_MAX_DELIVERIES: PEL deliveries before transient failures route to DLQ (default 8).
- AUDIT_CLAIM_IDLE_SECS: XAutoClaim min-idle window in seconds (default 60).
- HOSTNAME: consumer name within the audit-ingestor group (default "audit-1").

## Forbidden
- Must not import from caracalEnterprise/.
- Must not store plaintext claims, tokens, or PII.
- Must not add features beyond plan.md checkboxes.
