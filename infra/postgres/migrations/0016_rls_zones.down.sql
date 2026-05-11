-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Revert Row Level Security for zone-scoped tables.

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'providers',
        'applications',
        'sessions',
        'secrets',
        'delegated_grants',
        'policies',
        'policy_sets',
        'policy_set_bindings',
        'resources',
        'audit_events',
        'agent_sessions',
        'invitations',
        'teams',
        'delegation_edges',
        'agent_services',
        'agent_invocations',
        'gateway_resource_bindings',
        'resource_rate_limits',
        'step_up_challenges',
        'admin_audit_events',
        'admin_tokens',
        'delegation_graph_epochs'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS zone_isolation ON %I', t);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
END
$$;
