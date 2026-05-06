-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes agent service discovery and transactional outbox tables.

DROP TABLE IF EXISTS caracal_outbox;
DROP TABLE IF EXISTS resource_rate_limits;
DROP TABLE IF EXISTS delegation_graph_epochs;
DROP TABLE IF EXISTS agent_services;
