-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds agent service discovery and transactional outbox tables.

CREATE TABLE agent_services (
    id                  TEXT PRIMARY KEY,
    zone_id             TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    application_id      TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    endpoint_url        TEXT NOT NULL,
    protocol_versions   TEXT[] NOT NULL DEFAULT '{}',
    framework_name      TEXT,
    framework_version   TEXT,
    capabilities        TEXT[] NOT NULL DEFAULT '{}',
    health              TEXT NOT NULL DEFAULT 'starting' CHECK (health IN ('starting', 'healthy', 'degraded', 'unhealthy')),
    metadata_json       JSONB NOT NULL DEFAULT '{}',
    last_heartbeat_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, application_id, endpoint_url)
);
CREATE INDEX ON agent_services(zone_id, health);
CREATE INDEX ON agent_services(zone_id, application_id);
CREATE INDEX ON agent_services(last_heartbeat_at) WHERE health IN ('healthy', 'degraded');

CREATE TABLE caracal_outbox (
    id             TEXT PRIMARY KEY,
    producer       TEXT NOT NULL CHECK (producer IN ('api', 'coordinator')),
    topic          TEXT NOT NULL,
    dedupe_key     TEXT NOT NULL,
    payload_json   JSONB NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'dead')),
    attempts       INT NOT NULL DEFAULT 0,
    available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (producer, topic, dedupe_key)
);
CREATE INDEX ON caracal_outbox(status, available_at);
CREATE INDEX ON caracal_outbox(topic, status);

CREATE TABLE delegation_graph_epochs (
    zone_id     TEXT PRIMARY KEY REFERENCES zones(id) ON DELETE CASCADE,
    epoch       BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resource_rate_limits (
    zone_id          TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    resource_id      TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    window_seconds   INT NOT NULL CHECK (window_seconds > 0),
    max_requests     BIGINT NOT NULL CHECK (max_requests > 0),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (zone_id, resource_id)
);

GRANT SELECT, INSERT, UPDATE ON agent_services TO caracalCoordinator;
GRANT SELECT ON agent_services TO caracalApi, caracalSts;
GRANT SELECT, INSERT, UPDATE ON caracal_outbox TO caracalApi, caracalCoordinator;
GRANT SELECT, INSERT, UPDATE ON delegation_graph_epochs TO caracalCoordinator;
GRANT SELECT ON delegation_graph_epochs TO caracalApi, caracalSts;
GRANT SELECT, INSERT, UPDATE ON resource_rate_limits TO caracalApi;
GRANT SELECT ON resource_rate_limits TO caracalSts, caracalCoordinator;
