-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Per-service database roles and grants.

CREATE ROLE caracalSts NOLOGIN;
CREATE ROLE caracalApi NOLOGIN;
CREATE ROLE caracalAudit NOLOGIN;
CREATE ROLE caracalCoordinator NOLOGIN;
CREATE ROLE caracalGateway NOLOGIN;

-- STS: reads most entities; owns sessions, delegated_grants, secrets, step_up_challenges
GRANT SELECT ON
    zones, applications, providers, resources, application_dependencies,
    policies, policy_versions, policy_sets, policy_set_versions, policy_set_bindings
TO caracalSts;
GRANT SELECT, INSERT, UPDATE ON sessions, delegated_grants, secrets, step_up_challenges TO caracalSts;

-- API: full CRUD on all management entities; INSERT-only on immutable version tables
GRANT SELECT, INSERT, UPDATE, DELETE ON
    zones, applications, providers, resources, application_dependencies,
    policies, policy_sets, delegated_grants, secrets, invitations, teams
TO caracalApi;
GRANT SELECT, INSERT ON policy_versions, policy_set_versions TO caracalApi;
GRANT SELECT, INSERT, UPDATE, DELETE ON policy_set_bindings TO caracalApi;
GRANT SELECT ON sessions TO caracalApi;

-- Audit: append-only access to the audit log
GRANT SELECT, INSERT ON audit_events TO caracalAudit;

-- Coordinator: manages agent lifecycle; reads zone/application context
GRANT SELECT, INSERT, UPDATE ON agent_sessions, agent_topology TO caracalCoordinator;
GRANT SELECT ON zones, applications TO caracalCoordinator;

-- Gateway: read-only access to resolve resource and application identity
GRANT SELECT ON zones, applications, resources, providers TO caracalGateway;
