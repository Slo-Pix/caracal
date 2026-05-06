// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CLI config shape and EXIT_CODES unit tests.

import { test, expect, describe } from 'vitest'
import type { CliConfig } from '../../../../apps/cli/src/config.js'
import { EXIT_CODES } from '../../../../apps/cli/src/config.js'

describe('EXIT_CODES', () => {
  test('ok is 0', () => {
    expect(EXIT_CODES.ok).toBe(0)
  })

  test('credentialFailed is 1', () => {
    expect(EXIT_CODES.credentialFailed).toBe(1)
  })

  test('mcpBlocked is 1', () => {
    expect(EXIT_CODES.mcpBlocked).toBe(1)
  })

  test('childFailed is 2', () => {
    expect(EXIT_CODES.childFailed).toBe(2)
  })
})

describe('CliConfig shape', () => {
  test('minimal valid config is accepted by TypeScript', () => {
    const cfg: CliConfig = {
      zone_url: 'https://sts.example.com',
      app_client_id: 'zone1:app1',
      app_client_secret: 'secret',
    }
    expect(cfg.zone_url).toBe('https://sts.example.com')
    expect(cfg.credentials).toBeUndefined()
    expect(cfg.continue_on_failure).toBeUndefined()
  })

  test('config with optional credentials is valid', () => {
    const cfg: CliConfig = {
      zone_url: 'https://sts.example.com',
      app_client_id: 'zone1:app1',
      app_client_secret: 'secret',
      optional_credentials: [
        { env: 'DB_TOKEN', resource: 'resource://db', on_failure: 'warn' },
      ],
      continue_on_failure: true,
    }
    expect(cfg.optional_credentials?.length).toBe(1)
    expect(cfg.continue_on_failure).toBe(true)
  })

  test('mcp_governance mode can be block or log', () => {
    const blockCfg: CliConfig = {
      zone_url: 'https://sts.example.com',
      app_client_id: 'z:a',
      app_client_secret: 's',
      mcp_governance: { mode: 'block' },
    }
    const logCfg: CliConfig = {
      zone_url: 'https://sts.example.com',
      app_client_id: 'z:a',
      app_client_secret: 's',
      mcp_governance: { mode: 'log' },
    }
    expect(blockCfg.mcp_governance?.mode).toBe('block')
    expect(logCfg.mcp_governance?.mode).toBe('log')
  })
})
