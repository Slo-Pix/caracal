-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverts audit forensic hardening additions.

DROP INDEX IF EXISTS audit_ingest_alerts_zone_time;
DROP TABLE IF EXISTS audit_ingest_alerts;
DROP TABLE IF EXISTS audit_export_watermark;
DROP INDEX IF EXISTS audit_events_zone_chain;

ALTER TABLE audit_events
    DROP COLUMN IF EXISTS prev_content_sha256,
    DROP COLUMN IF EXISTS chain_hmac,
    DROP COLUMN IF EXISTS chain_seq,
    DROP COLUMN IF EXISTS ingest_signature;
