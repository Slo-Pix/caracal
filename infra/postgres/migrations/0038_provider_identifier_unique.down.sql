-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Removes the active provider identifier uniqueness guard.

DROP INDEX IF EXISTS providers_zone_identifier_active_uidx;
