-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes explicit agent session kind metadata.

ALTER TABLE agent_sessions
    DROP CONSTRAINT IF EXISTS agent_sessions_agent_kind_check;

ALTER TABLE agent_sessions
    DROP COLUMN IF EXISTS agent_kind;
