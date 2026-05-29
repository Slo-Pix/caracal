-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Adds explicit no-credential providers and requires every resource to bind a provider.

ALTER TABLE providers
    DROP CONSTRAINT IF EXISTS providers_provider_kind_check;

ALTER TABLE providers
    ADD CONSTRAINT providers_provider_kind_check CHECK (
        provider_kind IN ('none', 'caracal_mandate', 'oauth2_authorization_code', 'oauth2_client_credentials', 'api_key', 'bearer_token')
    );

INSERT INTO providers (id, zone_id, name, identifier, provider_kind, config_json, secret_config_keys)
SELECT DISTINCT
    'provider-none-' || zone_id,
    zone_id,
    'No credential',
    'provider://none',
    'none',
    '{}'::jsonb,
    '{}'
FROM resources
WHERE credential_provider_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE resources
SET credential_provider_id = 'provider-none-' || zone_id,
    updated_at = now()
WHERE credential_provider_id IS NULL;

ALTER TABLE resources
    ALTER COLUMN credential_provider_id SET NOT NULL;
