-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Enforces unique active provider identifiers within each zone.

WITH duplicates AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY zone_id, identifier
            ORDER BY created_at, id
        ) AS rank
    FROM providers
    WHERE archived_at IS NULL
),
renamed AS (
    SELECT
        id,
        '-dedup-' || id AS suffix
    FROM duplicates
    WHERE rank > 1
)
UPDATE providers p
SET identifier = p.identifier || r.suffix,
    updated_at = now()
FROM renamed r
WHERE p.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS providers_zone_identifier_active_uidx
    ON providers(zone_id, identifier)
    WHERE archived_at IS NULL;
