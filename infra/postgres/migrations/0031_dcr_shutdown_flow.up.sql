-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Allows the API to atomically revoke DCR runtime state during zone shutdown.

GRANT UPDATE ON sessions TO caracalApi;
GRANT SELECT, UPDATE ON agent_sessions TO caracalApi;
GRANT SELECT, UPDATE ON delegation_edges TO caracalApi;
GRANT SELECT ON sessions TO caracalCoordinator;
