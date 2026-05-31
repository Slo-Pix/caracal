// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared credential command for issuing scoped tokens.

import { OAuthClient } from '@caracalai/oauth'
import type { RuntimeConfig } from './runtimeConfig.js'

export interface CredentialReadOpts {
  cfg: RuntimeConfig
  resource: string
  scopes?: string[]
  ttlSeconds?: number
}

const DEFAULT_TTL_SECONDS = 900

export async function credentialRead(opts: CredentialReadOpts): Promise<string> {
  if (!opts.resource) throw new Error('resource is required')
  const cfg = opts.cfg
  const client = new OAuthClient(cfg.zone_url, cfg.zone_id, cfg.application_id)
  const token = await client.exchange('', opts.resource, {
    clientSecret: cfg.app_client_secret,
    scopes: opts.scopes,
    ttlSeconds: opts.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  })
  return token.accessToken
}
