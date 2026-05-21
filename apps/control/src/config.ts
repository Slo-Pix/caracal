// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service configuration loaded from environment variables.

import { getenv, intEnv, mustGetenv, resolveFileSecrets } from '@caracalai/core'

export interface Config {
  addr: string
  port: number
  host: string
  mode: 'dev' | 'rc' | 'stable'
  jwksUrl: string
  issuer: string
  audience: string
  redisUrl: string | undefined
  auditHmacKey: Buffer | undefined
  apiUrl: string
  apiToken: string
  rateCapacity: number
  rateWindowSec: number
  replayTtlSec: number
  logLevel: string
  gateFile: string | undefined
}

function readMode(): 'dev' | 'rc' | 'stable' {
  const m = process.env.CARACAL_MODE
  if (m === 'rc' || m === 'stable') return m
  return 'dev'
}

function readHmacKey(required: boolean): Buffer | undefined {
  const raw = process.env.AUDIT_HMAC_KEY
  if (!raw) {
    if (required) throw new Error('AUDIT_HMAC_KEY is required when CARACAL_MODE=rc or stable')
    return undefined
  }
  const key = Buffer.from(raw, 'hex')
  if (key.length < 32) throw new Error('AUDIT_HMAC_KEY must be hex-encoded with at least 32 bytes')
  return key
}

export function loadConfig(): Config {
  resolveFileSecrets([
    'CONTROL_REDIS_URL',
    'AUDIT_HMAC_KEY',
    'CONTROL_API_TOKEN',
  ])
  const mode = readMode()
  const prodLike = mode !== 'dev'
  const redisUrl = process.env.CONTROL_REDIS_URL || undefined
  if (prodLike && !redisUrl) {
    throw new Error('CONTROL_REDIS_URL is required when CARACAL_MODE=rc or stable')
  }
  return {
    addr: getenv('CONTROL_ADDR', ':8087'),
    port: intEnv('CONTROL_PORT', 8087, 1),
    host: getenv('CONTROL_HOST', prodLike ? '0.0.0.0' : '127.0.0.1'),
    mode,
    jwksUrl: mustGetenv('STS_JWKS_URL'),
    issuer: mustGetenv('STS_ISSUER_URL'),
    audience: mustGetenv('CONTROL_AUDIENCE'),
    redisUrl,
    auditHmacKey: readHmacKey(prodLike),
    apiUrl: mustGetenv('CARACAL_API_URL'),
    apiToken: mustGetenv('CONTROL_API_TOKEN'),
    rateCapacity: intEnv('CONTROL_RATE_CAPACITY', 60, 1),
    rateWindowSec: intEnv('CONTROL_RATE_WINDOW_SEC', 60, 1),
    replayTtlSec: intEnv('CONTROL_REPLAY_TTL_SEC', 3600, 1),
    logLevel: getenv('LOG_LEVEL', 'info'),
    gateFile: process.env.CONTROL_GATE_FILE || undefined,
  }
}
