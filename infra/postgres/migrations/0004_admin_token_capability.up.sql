-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds a read/write capability to admin tokens so a least-privilege, read-only admin credential can be minted that cannot mutate state at the API.

ALTER TABLE public.admin_tokens
    ADD COLUMN capability text DEFAULT 'write'::text NOT NULL
    CONSTRAINT admin_tokens_capability_check CHECK ((capability = ANY (ARRAY['read'::text, 'write'::text])));
