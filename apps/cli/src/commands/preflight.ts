// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Local config preflight checks: env vars, key material, TLS files, and Postgres/Redis reachability.

import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { X509Certificate } from 'node:crypto'

export interface PreflightCheck {
  check: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

const KEY_MIN_BYTES = 32
const TLS_EXPIRY_WARN_DAYS = 30
const TCP_TIMEOUT_MS = 5000

function fileBacked(name: string): string | undefined {
  const direct = process.env[name]
  if (direct) return direct
  const filePath = process.env[`${name}_FILE`]
  if (!filePath) return undefined
  try {
    return readFileSync(filePath, 'utf8').trim()
  } catch (err) {
    throw new Error(`${name}_FILE unreadable: ${(err as Error).message}`)
  }
}

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) return Buffer.from(raw, 'hex')
  return Buffer.from(raw, 'base64')
}

function checkMode(): PreflightCheck {
  const mode = process.env.CARACAL_MODE ?? 'dev'
  if (mode !== 'dev' && mode !== 'rc' && mode !== 'stable') {
    return { check: 'CARACAL_MODE', status: 'fail', detail: `unknown mode "${mode}"; expected dev | rc | stable` }
  }
  if (mode === 'stable') {
    const stsUrl = process.env.STS_URL ?? ''
    try {
      const u = new URL(stsUrl)
      if (!u.host) throw new Error('missing host')
    } catch {
      return { check: 'CARACAL_MODE', status: 'fail', detail: 'stable mode requires absolute STS_URL' }
    }
  }
  return { check: 'CARACAL_MODE', status: 'ok', detail: mode }
}

function checkKey(name: string, expectedBytes: number, exact: boolean): PreflightCheck {
  let raw: string | undefined
  try {
    raw = fileBacked(name)
  } catch (err) {
    return { check: name, status: 'fail', detail: (err as Error).message }
  }
  if (!raw) return { check: name, status: 'fail', detail: 'not set' }
  let key: Buffer
  try {
    key = decodeKey(raw)
  } catch (err) {
    return { check: name, status: 'fail', detail: `decode failed: ${(err as Error).message}` }
  }
  if (exact && key.length !== expectedBytes) {
    return { check: name, status: 'fail', detail: `expected ${expectedBytes} bytes, got ${key.length}` }
  }
  if (!exact && key.length < expectedBytes) {
    return { check: name, status: 'fail', detail: `expected at least ${expectedBytes} bytes, got ${key.length}` }
  }
  return { check: name, status: 'ok', detail: `${key.length} bytes` }
}

function checkTLS(): PreflightCheck[] {
  const cert = process.env.TLS_CERT_FILE
  const key = process.env.TLS_KEY_FILE
  if (!cert && !key) return [{ check: 'TLS files', status: 'warn', detail: 'not configured (gateway will refuse to start in stable mode)' }]
  if (!cert || !key) return [{ check: 'TLS files', status: 'fail', detail: 'TLS_CERT_FILE and TLS_KEY_FILE must both be set' }]
  let pem: string
  try {
    pem = readFileSync(cert, 'utf8')
  } catch (err) {
    return [{ check: 'TLS cert', status: 'fail', detail: `${cert}: ${(err as Error).message}` }]
  }
  try {
    readFileSync(key, 'utf8')
  } catch (err) {
    return [{ check: 'TLS key', status: 'fail', detail: `${key}: ${(err as Error).message}` }]
  }
  let x509: X509Certificate
  try {
    x509 = new X509Certificate(pem)
  } catch (err) {
    return [{ check: 'TLS cert', status: 'fail', detail: `parse failed: ${(err as Error).message}` }]
  }
  const expiry = new Date(x509.validTo)
  const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (daysLeft < 0) return [{ check: 'TLS cert', status: 'fail', detail: `expired ${-daysLeft} day(s) ago` }]
  if (daysLeft < TLS_EXPIRY_WARN_DAYS) return [{ check: 'TLS cert', status: 'warn', detail: `expires in ${daysLeft} day(s)` }]
  return [{ check: 'TLS cert', status: 'ok', detail: `${x509.subject}; ${daysLeft} day(s) until expiry` }]
}

async function tcpProbe(name: string, host: string, port: number, hello?: { send: Buffer; expectPrefix: Buffer }): Promise<PreflightCheck> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: TCP_TIMEOUT_MS })
    let settled = false
    const finish = (result: PreflightCheck) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    socket.on('error', (err) => finish({ check: name, status: 'fail', detail: `${host}:${port} ${err.message}` }))
    socket.on('timeout', () => finish({ check: name, status: 'fail', detail: `${host}:${port} timeout after ${TCP_TIMEOUT_MS}ms` }))
    socket.on('connect', () => {
      if (!hello) return finish({ check: name, status: 'ok', detail: `${host}:${port} reachable` })
      socket.write(hello.send)
    })
    socket.on('data', (chunk) => {
      if (!hello) return
      if (chunk.subarray(0, hello.expectPrefix.length).equals(hello.expectPrefix)) {
        finish({ check: name, status: 'ok', detail: `${host}:${port} responded` })
      } else {
        finish({ check: name, status: 'fail', detail: `${host}:${port} unexpected response: ${chunk.toString('utf8').slice(0, 60)}` })
      }
    })
  })
}

async function checkPostgres(): Promise<PreflightCheck> {
  let raw: string | undefined
  try {
    raw = fileBacked('DATABASE_URL')
  } catch (err) {
    return { check: 'Postgres', status: 'fail', detail: (err as Error).message }
  }
  if (!raw) return { check: 'Postgres', status: 'fail', detail: 'DATABASE_URL not set' }
  let host: string
  let port: number
  try {
    const u = new URL(raw)
    host = u.hostname
    port = u.port ? Number(u.port) : 5432
  } catch (err) {
    return { check: 'Postgres', status: 'fail', detail: `parse DATABASE_URL: ${(err as Error).message}` }
  }
  return tcpProbe('Postgres', host, port)
}

async function checkRedis(): Promise<PreflightCheck> {
  let raw: string | undefined
  try {
    raw = fileBacked('REDIS_URL')
  } catch (err) {
    return { check: 'Redis', status: 'fail', detail: (err as Error).message }
  }
  if (!raw) return { check: 'Redis', status: 'fail', detail: 'REDIS_URL not set' }
  let host: string
  let port: number
  try {
    const u = new URL(raw)
    host = u.hostname
    port = u.port ? Number(u.port) : 6379
  } catch (err) {
    return { check: 'Redis', status: 'fail', detail: `parse REDIS_URL: ${(err as Error).message}` }
  }
  return tcpProbe('Redis', host, port, {
    send: Buffer.from('*1\r\n$4\r\nPING\r\n'),
    expectPrefix: Buffer.from('+PONG'),
  })
}

export async function runPreflightChecks(): Promise<PreflightCheck[]> {
  const checks: PreflightCheck[] = []
  checks.push(checkMode())
  checks.push(checkKey('ZONE_KEK', 32, true))
  checks.push(checkKey('AUDIT_HMAC_KEY', KEY_MIN_BYTES, false))
  checks.push(checkKey('STREAMS_HMAC_KEY', KEY_MIN_BYTES, false))
  checks.push(checkKey('GATEWAY_STS_HMAC_KEY', KEY_MIN_BYTES, false))
  checks.push(...checkTLS())
  checks.push(await checkPostgres())
  checks.push(await checkRedis())
  return checks
}
