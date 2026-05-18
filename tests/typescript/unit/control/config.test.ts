// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service configuration tests for dev and published runtime environments.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../../../../apps/control/src/config.js'

const KEYS = [
  'CARACAL_MODE',
  'CONTROL_REDIS_URL',
  'CONTROL_REDIS_URL_FILE',
  'AUDIT_HMAC_KEY',
  'AUDIT_HMAC_KEY_FILE',
  'CONTROL_API_TOKEN',
  'CONTROL_API_TOKEN_FILE',
  'STS_JWKS_URL',
  'STS_ISSUER_URL',
  'CONTROL_AUDIENCE',
  'CARACAL_API_URL',
  'CONTROL_RATE_CAPACITY',
]

let dir: string

function setBaseEnv(): void {
  process.env.STS_JWKS_URL = 'http://sts:8080/.well-known/jwks.json'
  process.env.STS_ISSUER_URL = 'http://sts:8080'
  process.env.CONTROL_AUDIENCE = 'caracal-control'
  process.env.CARACAL_API_URL = 'http://api:3000'
  process.env.CONTROL_API_TOKEN = 'admin-token'
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'caracal-control-config-'))
  for (const key of KEYS) delete process.env[key]
  setBaseEnv()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  for (const key of KEYS) delete process.env[key]
})

describe('control loadConfig', () => {
  it('uses dev defaults without redis or audit HMAC material', () => {
    process.env.CARACAL_MODE = 'dev'

    const cfg = loadConfig()

    expect(cfg.mode).toBe('dev')
    expect(cfg.host).toBe('127.0.0.1')
    expect(cfg.redisUrl).toBeUndefined()
    expect(cfg.auditHmacKey).toBeUndefined()
  })

  it('requires redis URL in rc and stable modes', () => {
    for (const mode of ['rc', 'stable'] as const) {
      process.env.CARACAL_MODE = mode

      expect(() => loadConfig()).toThrow('CONTROL_REDIS_URL is required')
    }
  })

  it('requires audit HMAC material in published modes', () => {
    process.env.CARACAL_MODE = 'stable'
    process.env.CONTROL_REDIS_URL = 'redis://redis:6379'

    expect(() => loadConfig()).toThrow('AUDIT_HMAC_KEY is required')
  })

  it('resolves published secrets from _FILE paths and clears file env vars', () => {
    const redisFile = join(dir, 'redisUrl')
    const hmacFile = join(dir, 'auditHmacKey')
    const tokenFile = join(dir, 'caracalAdminToken')
    writeFileSync(redisFile, 'redis://file:6379\n')
    writeFileSync(hmacFile, `${'ab'.repeat(32)}\n`)
    writeFileSync(tokenFile, 'file-token\n')
    process.env.CARACAL_MODE = 'stable'
    delete process.env.CONTROL_API_TOKEN
    process.env.CONTROL_REDIS_URL_FILE = redisFile
    process.env.AUDIT_HMAC_KEY_FILE = hmacFile
    process.env.CONTROL_API_TOKEN_FILE = tokenFile

    const cfg = loadConfig()

    expect(cfg.mode).toBe('stable')
    expect(cfg.host).toBe('0.0.0.0')
    expect(cfg.redisUrl).toBe('redis://file:6379')
    expect(cfg.auditHmacKey?.length).toBe(32)
    expect(cfg.apiToken).toBe('file-token')
    expect(process.env.CONTROL_REDIS_URL_FILE).toBeUndefined()
    expect(process.env.AUDIT_HMAC_KEY_FILE).toBeUndefined()
    expect(process.env.CONTROL_API_TOKEN_FILE).toBeUndefined()
  })

  it('rejects invalid audit HMAC and integer values', () => {
    process.env.CARACAL_MODE = 'stable'
    process.env.CONTROL_REDIS_URL = 'redis://redis:6379'
    process.env.AUDIT_HMAC_KEY = 'abc'
    expect(() => loadConfig()).toThrow('AUDIT_HMAC_KEY must be hex-encoded')

    process.env.AUDIT_HMAC_KEY = 'ab'.repeat(32)
    process.env.CONTROL_RATE_CAPACITY = '0'
    expect(() => loadConfig()).toThrow('Invalid integer env var CONTROL_RATE_CAPACITY')
  })
})
