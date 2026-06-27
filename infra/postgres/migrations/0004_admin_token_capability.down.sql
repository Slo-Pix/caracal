-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverses the admin token read/write capability column; development and CI only, never invoked by production tooling.

ALTER TABLE public.admin_tokens
    DROP COLUMN IF EXISTS capability;
