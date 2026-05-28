-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes API DCR runtime-state revocation grants.

REVOKE UPDATE ON sessions FROM caracalApi;
REVOKE SELECT, UPDATE ON agent_sessions FROM caracalApi;
REVOKE SELECT, UPDATE ON delegation_edges FROM caracalApi;
REVOKE SELECT ON sessions FROM caracalCoordinator;
