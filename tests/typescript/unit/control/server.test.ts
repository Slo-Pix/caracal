// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control server tests cover health, readiness, gate state, and dependency cleanup.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Config } from '../../../../apps/control/src/config.js'

const redisInstances: Array<{ ping: ReturnType<typeof vi.fn>; quit: ReturnType<typeof vi.fn> }> = []

vi.mock('ioredis', () => ({
  Redis: class Redis {
    readonly ping = vi.fn(async () => 'PONG')
    readonly quit = vi.fn(async () => 'OK')

    constructor() {
      redisInstances.push(this)
    }
  },
}))

vi.mock('@caracalai/admin', () => ({
  AdminClient: class AdminClient {
    readonly zones = { list: vi.fn() }
  },
}))

vi.mock('@caracalai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@caracalai/core')>()
  return {
    ...actual,
    instrumentFastifyApp: vi.fn(),
  }
})

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

function config(overrides: Partial<Config> = {}): Config {
  return {
    addr: ':8087',
    port: 8087,
    host: '127.0.0.1',
    mode: 'dev',
    jwksUrl: 'https://sts.example.com/.well-known/jwks.json',
    issuer: 'https://sts.example.com',
    audience: 'caracal-control',
    redisUrl: undefined,
    auditHmacKey: undefined,
    apiUrl: 'https://api.example.com',
    apiToken: 'admin-token',
    rateCapacity: 10,
    rateWindowSec: 60,
    replayTtlSec: 3600,
    logLevel: 'fatal',
    gateFile: undefined,
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  redisInstances.splice(0)
})

describe('buildServer', () => {
  it('serves health and reports readiness from the file gate', async () => {
    vi.resetModules()
    const dir = mkdtempSync(join(tmpdir(), 'caracal-control-'))
    const gateFile = join(dir, 'enabled')
    writeFileSync(gateFile, '1')
    const { buildServer } = await import('../../../../apps/control/src/server.js')
    const server = await buildServer(config({ gateFile }), log)

    try {
      expect((await server.app.inject('/health')).statusCode).toBe(200)
      expect((await server.app.inject('/ready')).statusCode).toBe(200)
      rmSync(gateFile, { force: true })
      const disabled = await server.app.inject('/ready')
      expect(disabled.statusCode).toBe(503)
      expect(disabled.json()).toEqual({ error: 'control disabled' })
    } finally {
      await server.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('closes the Fastify server in memory mode without external clients', async () => {
    vi.resetModules()
    const { buildServer } = await import('../../../../apps/control/src/server.js')
    const server = await buildServer(config(), log)

    await server.close()

    expect(redisInstances).toHaveLength(0)
  })
})
