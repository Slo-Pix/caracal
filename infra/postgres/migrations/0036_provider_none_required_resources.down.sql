-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Restores nullable provider bindings and removes the no-credential provider kind.

ALTER TABLE resources
    ALTER COLUMN credential_provider_id DROP NOT NULL;

UPDATE resources r
SET credential_provider_id = NULL,
    updated_at = now()
FROM providers p
WHERE r.credential_provider_id = p.id
  AND r.zone_id = p.zone_id
  AND p.provider_kind = 'none';

UPDATE providers
SET provider_kind = 'caracal_mandate',
    archived_at = COALESCE(archived_at, now()),
    updated_at = now()
WHERE provider_kind = 'none';

ALTER TABLE providers
    DROP CONSTRAINT IF EXISTS providers_provider_kind_check;

ALTER TABLE providers
    ADD CONSTRAINT providers_provider_kind_check CHECK (
        provider_kind IN ('caracal_mandate', 'oauth2_authorization_code', 'oauth2_client_credentials', 'api_key', 'bearer_token')
    );
