-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- STS hardening: bind step-up challenges to subject and resource set, store proof,
-- track single-use consumption, and add JWKS zone-bound key rotation pointer.

ALTER TABLE step_up_challenges
    ADD COLUMN IF NOT EXISTS challenge_secret_hash BYTEA,
    ADD COLUMN IF NOT EXISTS principal_id          TEXT,
    ADD COLUMN IF NOT EXISTS resource_set_hash     BYTEA,
    ADD COLUMN IF NOT EXISTS consumed_at           TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS step_up_challenges_consume_uniq
    ON step_up_challenges (id)
    WHERE consumed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS step_up_challenges_zone_principal
    ON step_up_challenges (zone_id, principal_id)
    WHERE consumed_at IS NULL;
