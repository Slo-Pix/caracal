-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Down migration for per-service roles.

DROP ROLE IF EXISTS caracalGateway;
DROP ROLE IF EXISTS caracalCoordinator;
DROP ROLE IF EXISTS caracalAudit;
DROP ROLE IF EXISTS caracalApi;
DROP ROLE IF EXISTS caracalSts;
