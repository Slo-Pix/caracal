// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared helpers for engine verbs: AdminClient bootstrap and file content reads.

import { readFileSync } from 'node:fs'
import { AdminClient } from '@caracalai/admin'
import { discoverAdminToken, runtimeEnvFile } from '@caracalai/core'
import {
  DEFAULT_API_URL,
  DEFAULT_COORDINATOR_URL,
  resolveServiceUrl,
} from '@caracalai/core/cli'
import type { CliConfig } from '@caracalai/core/cli'

export interface AdminContext {
  client: AdminClient
  zoneId: string | undefined
  apiUrl: string
}

export function buildAdminClient(cfg?: CliConfig): AdminContext {
  const adminToken = discoverAdminToken()
  if (!adminToken) {
    throw new Error(
      `CARACAL_ADMIN_TOKEN not set; export it or run \`caracal up\` (writes ${runtimeEnvFile()})`,
    )
  }
  const apiUrl = resolveServiceUrl('CARACAL_API_URL', DEFAULT_API_URL)
  const coordinatorUrl = resolveServiceUrl('CARACAL_COORDINATOR_URL', DEFAULT_COORDINATOR_URL)
  const coordinatorToken = process.env.CARACAL_COORDINATOR_TOKEN
  const zoneId = process.env.CARACAL_ZONE_ID ?? cfg?.zone_id
  return {
    client: new AdminClient({ apiUrl, coordinatorUrl, adminToken, coordinatorToken }),
    zoneId,
    apiUrl,
  }
}

export function readContent(value: string | undefined): string {
  if (!value) {
    throw new Error('missing content; use --file <path> or --content <inline>')
  }
  if (value.startsWith('@')) {
    return readFileSync(value.slice(1), 'utf8')
  }
  return value
}
