-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverses the zone ownership column; development and CI only, never invoked by production tooling.

DROP INDEX IF EXISTS public.zones_owner_account_id_idx;

ALTER TABLE public.zones
    DROP COLUMN IF EXISTS owner_account_id;
