-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Down migration: drops all tables in dependency-safe order.

DROP TRIGGER IF EXISTS policy_versions_immutable ON policy_versions;
DROP FUNCTION IF EXISTS reject_policy_version_mutation();

DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS step_up_challenges;
DROP TABLE IF EXISTS agent_topology;
DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS policy_set_bindings;
DROP TABLE IF EXISTS policy_set_versions;
DROP TABLE IF EXISTS policy_sets;
DROP TABLE IF EXISTS policy_versions;
DROP TABLE IF EXISTS policies;
DROP TABLE IF EXISTS delegated_grants;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS secrets;
DROP TABLE IF EXISTS application_dependencies;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS zones;
