// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Recursive redaction of sensitive fields in JSON payloads returned to read APIs.

const REDACTED = '[redacted]'

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'set_cookie',
  'client_secret',
  'private_key',
  'session',
  'session_id',
  'assertion',
])

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactSensitive(v)
  }
  return out
}
