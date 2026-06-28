-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds nullable zone ownership so each Console account owns the zones it creates, the foundation for per-account isolation; legacy zones stay unowned and shared until migrated.

ALTER TABLE public.zones
    ADD COLUMN owner_account_id text;

CREATE INDEX zones_owner_account_id_idx
    ON public.zones (owner_account_id)
    WHERE (owner_account_id IS NOT NULL);
