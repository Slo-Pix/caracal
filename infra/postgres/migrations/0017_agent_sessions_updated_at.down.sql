-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverts the updated_at column on agent_sessions.

ALTER TABLE agent_sessions
    DROP COLUMN IF EXISTS updated_at;
