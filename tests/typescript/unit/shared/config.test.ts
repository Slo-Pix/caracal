// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TypeScript shared config tests for environment defaults and required values.

import { afterEach, describe, expect, it } from 'vitest'
import { getenv, loadBaseConfig, mustGetenv } from '../../../../packages/core/ts/src/config.js'

describe('shared config', () => {
  afterEach(() => {
    delete process.env.CARACAL_TEST_VALUE
    delete process.env.PORT
    delete process.env.DATABASE_URL
    delete process.env.REDIS_URL
    delete process.env.STS_URL
    delete process.env.LOG_LEVEL
  })

  it('reads required and fallback environment values', () => {
    process.env.CARACAL_TEST_VALUE = 'configured'

    expect(mustGetenv('CARACAL_TEST_VALUE')).toBe('configured')
    expect(getenv('CARACAL_TEST_MISSING', 'fallback')).toBe('fallback')
  })

  it('throws when required values are missing or empty', () => {
    process.env.CARACAL_TEST_VALUE = ''

    expect(() => mustGetenv('CARACAL_TEST_VALUE')).toThrow('Required env var missing: CARACAL_TEST_VALUE')
  })

  it('loads base service configuration from env', () => {
    process.env.PORT = '4000'
    process.env.DATABASE_URL = 'postgres://example'
    process.env.REDIS_URL = 'redis://example'

    expect(loadBaseConfig()).toEqual({
      port: 4000,
      databaseUrl: 'postgres://example',
      redisUrl: 'redis://example',
      stsUrl: 'http://localhost:8080',
      logLevel: 'info',
    })
  })
})