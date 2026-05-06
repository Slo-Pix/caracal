-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Audit forensic hardening: per-zone hash chain, HMAC, ingest-time tamper signal,
-- export watermark table, and monthly partition pre-creation.

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS prev_content_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS chain_hmac          TEXT,
    ADD COLUMN IF NOT EXISTS chain_seq           BIGINT,
    ADD COLUMN IF NOT EXISTS ingest_signature    TEXT;

CREATE INDEX IF NOT EXISTS audit_events_zone_chain
    ON audit_events (zone_id, chain_seq DESC);

-- Watermark for hourly Parquet export catch-up.
CREATE TABLE IF NOT EXISTS audit_export_watermark (
    name              TEXT PRIMARY KEY,
    last_exported_hour TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Counter for tamper events observed at ingest (duplicate id with mutated payload).
CREATE TABLE IF NOT EXISTS audit_ingest_alerts (
    id          BIGSERIAL PRIMARY KEY,
    event_id    TEXT NOT NULL,
    zone_id     TEXT NOT NULL,
    kind        TEXT NOT NULL,
    detail      TEXT,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_ingest_alerts_zone_time
    ON audit_ingest_alerts (zone_id, observed_at DESC);

-- Pre-create monthly partitions for current month and next three months.
-- The retention rotator goroutine maintains the rolling window thereafter.
DO $$
DECLARE
    m INT;
    start_ts TIMESTAMPTZ;
    end_ts   TIMESTAMPTZ;
    pname    TEXT;
BEGIN
    FOR m IN 0..3 LOOP
        start_ts := date_trunc('month', now()) + (m || ' months')::interval;
        end_ts   := start_ts + INTERVAL '1 month';
        pname    := format('audit_events_y%sm%s',
                           to_char(start_ts, 'YYYY'),
                           to_char(start_ts, 'MM'));
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_events
             FOR VALUES FROM (%L) TO (%L)',
            pname, start_ts, end_ts);
    END LOOP;
END $$;

GRANT SELECT, INSERT ON audit_export_watermark TO caracalAudit;
GRANT UPDATE         ON audit_export_watermark TO caracalAudit;
GRANT SELECT, INSERT ON audit_ingest_alerts    TO caracalAudit;
GRANT USAGE, SELECT  ON SEQUENCE audit_ingest_alerts_id_seq TO caracalAudit;
