-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Initial schema: all Caracal OSS tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE zones (
    id             TEXT PRIMARY KEY,
    org_id         TEXT NOT NULL,
    name           TEXT NOT NULL,
    slug           TEXT NOT NULL UNIQUE,
    dek_ciphertext BYTEA NOT NULL,
    kek_arn        TEXT,
    dcr_enabled    BOOLEAN NOT NULL DEFAULT false,
    pkce_required  BOOLEAN NOT NULL DEFAULT true,
    login_flow     TEXT NOT NULL DEFAULT 'default',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE providers (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL REFERENCES zones(id),
    name        TEXT NOT NULL,
    identifier  TEXT NOT NULL,
    owner_type  TEXT NOT NULL DEFAULT 'customer',
    config_json JSONB NOT NULL DEFAULT '{}',
    client_id   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
    id                  TEXT PRIMARY KEY,
    zone_id             TEXT NOT NULL REFERENCES zones(id),
    name                TEXT NOT NULL,
    registration_method TEXT NOT NULL CHECK (registration_method IN ('managed', 'dcr')),
    credential_type     TEXT CHECK (credential_type IN ('token', 'password', 'public-key', 'url', 'public')),
    client_secret_hash  TEXT,
    consent             TEXT NOT NULL DEFAULT 'required' CHECK (consent IN ('implicit', 'required')),
    traits              TEXT[] NOT NULL DEFAULT '{}',
    expires_at          TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    last_active_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON applications(zone_id);
CREATE INDEX ON applications(zone_id, expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE resources (
    id                     TEXT PRIMARY KEY,
    zone_id                TEXT NOT NULL REFERENCES zones(id),
    name                   TEXT NOT NULL,
    identifier             TEXT NOT NULL,
    upstream_url           TEXT,
    prefix                 BOOLEAN NOT NULL DEFAULT false,
    credential_provider_id TEXT REFERENCES providers(id),
    scopes                 TEXT[] NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, identifier)
);
CREATE INDEX ON resources(credential_provider_id);

CREATE TABLE application_dependencies (
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    resource_id    TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    PRIMARY KEY (application_id, resource_id)
);

-- nonce and dek_id required for ChaCha20 envelope decryption
CREATE TABLE secrets (
    id         TEXT PRIMARY KEY,
    zone_id    TEXT NOT NULL REFERENCES zones(id),
    entity_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK (type IN ('token', 'password')),
    ciphertext BYTEA NOT NULL,
    nonce      BYTEA NOT NULL,
    dek_id     TEXT NOT NULL,
    version    INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON secrets(zone_id, entity_id);

-- id IS the sid JWT claim; no FK to zones/applications for hot-path performance
CREATE TABLE sessions (
    id               TEXT PRIMARY KEY,
    zone_id          TEXT NOT NULL,
    session_type     TEXT NOT NULL CHECK (session_type IN ('user', 'application')),
    subject_id       TEXT,
    parent_id        TEXT REFERENCES sessions(id),
    status           TEXT NOT NULL DEFAULT 'active',
    expires_at       TIMESTAMPTZ NOT NULL,
    authenticated_at TIMESTAMPTZ NOT NULL,
    claims_json      JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON sessions(zone_id, subject_id, status);
CREATE INDEX ON sessions(expires_at) WHERE status = 'active';

CREATE TABLE delegated_grants (
    id               TEXT PRIMARY KEY,
    zone_id          TEXT NOT NULL,
    application_id   TEXT REFERENCES applications(id),
    user_id          TEXT NOT NULL,
    resource_id      TEXT NOT NULL,
    provider_id      TEXT,
    scopes           TEXT[] NOT NULL,
    status           TEXT NOT NULL DEFAULT 'active',
    access_token_ct  BYTEA,
    refresh_token_ct BYTEA,
    expires_at       TIMESTAMPTZ,
    refreshed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON delegated_grants(zone_id, user_id);
CREATE INDEX ON delegated_grants(zone_id, user_id, resource_id, status);

CREATE TABLE policies (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL REFERENCES zones(id),
    name        TEXT NOT NULL,
    description TEXT,
    owner_type  TEXT NOT NULL DEFAULT 'customer',
    archived_at TIMESTAMPTZ,
    created_by  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, name)
);

CREATE TABLE policy_versions (
    id             TEXT PRIMARY KEY,
    policy_id      TEXT NOT NULL REFERENCES policies(id),
    version        INT NOT NULL,
    content        TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    created_by     TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at    TIMESTAMPTZ,
    UNIQUE (policy_id, version)
);
CREATE INDEX ON policy_versions(policy_id, created_at DESC);

CREATE TABLE policy_sets (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL REFERENCES zones(id),
    name        TEXT NOT NULL,
    description TEXT,
    scope_type  TEXT NOT NULL DEFAULT 'zone',
    owner_type  TEXT NOT NULL DEFAULT 'customer',
    archived_at TIMESTAMPTZ,
    created_by  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, name)
);

CREATE TABLE policy_set_versions (
    id              TEXT PRIMARY KEY,
    policy_set_id   TEXT NOT NULL REFERENCES policy_sets(id),
    version         INT NOT NULL,
    manifest_json   JSONB NOT NULL,
    manifest_sha256 TEXT NOT NULL,
    schema_version  TEXT NOT NULL,
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at     TIMESTAMPTZ,
    UNIQUE (policy_set_id, version)
);

CREATE TABLE policy_set_bindings (
    zone_id           TEXT NOT NULL REFERENCES zones(id),
    policy_set_id     TEXT NOT NULL REFERENCES policy_sets(id),
    active_version_id TEXT REFERENCES policy_set_versions(id),
    shadow_version_id TEXT REFERENCES policy_set_versions(id),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (zone_id, policy_set_id)
);

-- Partition key included in PK per PostgreSQL partitioned table requirements
CREATE TABLE audit_events (
    id                        TEXT NOT NULL,
    zone_id                   TEXT NOT NULL,
    event_type                TEXT NOT NULL,
    request_id                TEXT,
    decision                  TEXT,
    policy_set_id             TEXT,
    policy_set_version_id     TEXT,
    manifest_sha              TEXT,
    evaluation_status         TEXT,
    determining_policies_json JSONB,
    diagnostics_json          JSONB,
    metadata_json             JSONB,
    occurred_at               TIMESTAMPTZ NOT NULL,
    ingested_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE TABLE audit_events_default PARTITION OF audit_events DEFAULT;
CREATE INDEX ON audit_events(zone_id, occurred_at DESC);
CREATE INDEX ON audit_events(request_id) WHERE request_id IS NOT NULL;

CREATE TABLE agent_sessions (
    id             TEXT PRIMARY KEY,
    zone_id        TEXT NOT NULL,
    application_id TEXT NOT NULL,
    parent_id      TEXT REFERENCES agent_sessions(id),
    session_sid    TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'active',
    depth          INT NOT NULL DEFAULT 0,
    capabilities   TEXT[] NOT NULL DEFAULT '{}',
    max_children   INT NOT NULL DEFAULT 10,
    child_count    INT NOT NULL DEFAULT 0,
    spawned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    terminated_at  TIMESTAMPTZ,
    ttl_seconds    INT NOT NULL DEFAULT 3600,
    metadata_json  JSONB
);
CREATE INDEX ON agent_sessions(zone_id, parent_id, status);
CREATE INDEX ON agent_sessions(session_sid);
CREATE INDEX ON agent_sessions(last_active_at) WHERE status = 'active';

CREATE TABLE agent_topology (
    parent_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    child_id  TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE step_up_challenges (
    id             TEXT PRIMARY KEY,
    zone_id        TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    session_id     TEXT,
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('human_approval', 'mfa', 'software_attestation')),
    metadata_json  JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    satisfied_at   TIMESTAMPTZ
);
CREATE INDEX ON step_up_challenges(session_id);

CREATE TABLE invitations (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    invited_by  TEXT NOT NULL,
    accepted_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON invitations(zone_id, email);

CREATE TABLE teams (
    id           TEXT PRIMARY KEY,
    zone_id      TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    members_json JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, name)
);

CREATE OR REPLACE FUNCTION reject_policy_version_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'policy_versions rows are immutable';
END $$;

CREATE TRIGGER policy_versions_immutable
BEFORE UPDATE OR DELETE ON policy_versions
FOR EACH ROW EXECUTE FUNCTION reject_policy_version_mutation();
