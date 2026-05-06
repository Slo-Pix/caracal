-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds content_sha256 column to audit_events for tamper detection.

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS content_sha256 TEXT;
