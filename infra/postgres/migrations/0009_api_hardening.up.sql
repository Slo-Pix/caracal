-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- API control-plane hardening: DB-backed admin tokens, admin audit log,
-- transactional event outbox for Redis stream publishes.

CREATE TABLE admin_tokens (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    token_sha256  BYTEA NOT NULL,
    scope         TEXT NOT NULL CHECK (scope IN ('global', 'zone')),
    zone_id       TEXT REFERENCES zones(id) ON DELETE CASCADE,
    created_by    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    CONSTRAINT admin_token_scope_zone_pair CHECK (
        (scope = 'global' AND zone_id IS NULL) OR
        (scope = 'zone'   AND zone_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX admin_tokens_token_sha256_active
    ON admin_tokens (token_sha256)
    WHERE revoked_at IS NULL;
CREATE INDEX admin_tokens_zone_active
    ON admin_tokens (zone_id)
    WHERE revoked_at IS NULL AND scope = 'zone';

CREATE TABLE admin_audit_events (
    id           TEXT PRIMARY KEY,
    request_id   TEXT NOT NULL,
    actor_id     TEXT,
    actor_name   TEXT,
    actor_scope  TEXT,
    action       TEXT NOT NULL,
    method       TEXT NOT NULL,
    path         TEXT NOT NULL,
    zone_id      TEXT,
    entity_type  TEXT,
    entity_id    TEXT,
    status_code  INT  NOT NULL,
    payload_json JSONB,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_events_zone_time
    ON admin_audit_events (zone_id, occurred_at DESC);
CREATE INDEX admin_audit_events_actor_time
    ON admin_audit_events (actor_id, occurred_at DESC)
    WHERE actor_id IS NOT NULL;
CREATE INDEX admin_audit_events_request
    ON admin_audit_events (request_id);

CREATE TABLE event_outbox (
    id            TEXT PRIMARY KEY,
    stream_name   TEXT NOT NULL,
    payload_json  JSONB NOT NULL,
    attempts      INT  NOT NULL DEFAULT 0,
    available_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until  TIMESTAMPTZ,
    locked_by     TEXT,
    last_error    TEXT,
    dispatched_at TIMESTAMPTZ,
    request_id    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_outbox_dispatch_ready
    ON event_outbox (available_at)
    WHERE dispatched_at IS NULL;
CREATE INDEX event_outbox_undispatched_age
    ON event_outbox (created_at)
    WHERE dispatched_at IS NULL;
