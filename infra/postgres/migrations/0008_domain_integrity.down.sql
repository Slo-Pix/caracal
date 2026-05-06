-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes same-zone ownership constraints for core domain references.

ALTER TABLE agent_invocations
    DROP CONSTRAINT agent_invocations_zone_target_fk,
    DROP CONSTRAINT agent_invocations_zone_source_fk,
    DROP CONSTRAINT agent_invocations_zone_service_fk,
    DROP CONSTRAINT agent_invocations_zone_id_id_unique;

ALTER TABLE delegation_edges
    DROP CONSTRAINT delegation_edges_zone_resource_fk,
    DROP CONSTRAINT delegation_edges_zone_receiver_application_fk,
    DROP CONSTRAINT delegation_edges_zone_issuer_application_fk,
    DROP CONSTRAINT delegation_edges_zone_target_fk,
    DROP CONSTRAINT delegation_edges_zone_source_fk;

ALTER TABLE agent_services
    DROP CONSTRAINT agent_services_zone_application_fk,
    DROP CONSTRAINT agent_services_zone_id_id_unique;

ALTER TABLE agent_sessions
    DROP CONSTRAINT agent_sessions_zone_parent_fk,
    DROP CONSTRAINT agent_sessions_zone_session_fk,
    DROP CONSTRAINT agent_sessions_zone_application_fk,
    DROP CONSTRAINT agent_sessions_status_check,
    DROP CONSTRAINT agent_sessions_zone_id_id_unique;

ALTER TABLE delegated_grants
    DROP CONSTRAINT delegated_grants_zone_provider_fk,
    DROP CONSTRAINT delegated_grants_zone_resource_fk,
    DROP CONSTRAINT delegated_grants_zone_application_fk,
    DROP CONSTRAINT delegated_grants_status_check;

ALTER TABLE sessions
    DROP CONSTRAINT sessions_status_check,
    DROP CONSTRAINT sessions_zone_id_id_unique;

ALTER TABLE resources
    DROP CONSTRAINT resources_zone_provider_fk,
    DROP CONSTRAINT resources_zone_id_id_unique;

ALTER TABLE applications
    DROP CONSTRAINT applications_zone_id_id_unique;

ALTER TABLE providers
    DROP CONSTRAINT providers_zone_id_id_unique;
