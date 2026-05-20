-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds explicit agent session kind for policy and audit decisions.

ALTER TABLE agent_sessions
    ADD COLUMN IF NOT EXISTS agent_kind TEXT NOT NULL DEFAULT 'ephemeral';

ALTER TABLE agent_sessions
    DROP CONSTRAINT IF EXISTS agent_sessions_agent_kind_check;

ALTER TABLE agent_sessions
    ADD CONSTRAINT agent_sessions_agent_kind_check
    CHECK (agent_kind IN ('service', 'instance', 'ephemeral'));
