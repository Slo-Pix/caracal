// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb body for `caracal credential read <resource>` — exchange a one-shot 15-min token.

import { OAuthClient } from '@caracalai/oauth'
import type { CliConfig } from '@caracalai/core/cli'

export interface CredentialReadOpts {
  cfg: CliConfig
  resource: string
  ttlSeconds?: number
}

const DEFAULT_TTL_SECONDS = 900

export async function credentialRead(opts: CredentialReadOpts): Promise<string> {
  if (!opts.resource) throw new Error('resource is required')
  const cfg = opts.cfg
  const client = new OAuthClient(cfg.zone_url, cfg.zone_id, cfg.application_id)
  const token = await client.exchange('', opts.resource, {
    clientSecret: cfg.app_client_secret,
    ttlSeconds: opts.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  })
  return token.accessToken
}
