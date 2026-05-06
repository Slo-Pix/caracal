-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds source-target delegation edges for graph-based agent authority.

CREATE TABLE delegation_edges (
    id                    TEXT PRIMARY KEY,
    zone_id               TEXT NOT NULL,
    source_session_id     TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    target_session_id     TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    issuer_application_id TEXT NOT NULL,
    receiver_application_id TEXT NOT NULL,
    resource_id           TEXT REFERENCES resources(id),
    scopes                TEXT[] NOT NULL DEFAULT '{}',
    constraints_json      JSONB NOT NULL DEFAULT '{}',
    status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    expires_at            TIMESTAMPTZ NOT NULL,
    edge_version          INT NOT NULL DEFAULT 0,
    revoked_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (source_session_id <> target_session_id)
);
CREATE INDEX ON delegation_edges(zone_id, source_session_id, status);
CREATE INDEX ON delegation_edges(zone_id, target_session_id, status);
CREATE INDEX ON delegation_edges(zone_id, resource_id, status) WHERE resource_id IS NOT NULL;
CREATE INDEX ON delegation_edges(expires_at) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE ON delegation_edges TO caracalCoordinator;
GRANT SELECT ON delegation_edges TO caracalSts;
