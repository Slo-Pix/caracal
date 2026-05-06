-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Reverse STS hardening migration.

DROP INDEX IF EXISTS step_up_challenges_zone_principal;
DROP INDEX IF EXISTS step_up_challenges_consume_uniq;

ALTER TABLE step_up_challenges
    DROP COLUMN IF EXISTS consumed_at,
    DROP COLUMN IF EXISTS resource_set_hash,
    DROP COLUMN IF EXISTS principal_id,
    DROP COLUMN IF EXISTS challenge_secret_hash;
