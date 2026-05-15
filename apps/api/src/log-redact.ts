// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Pino redact-path generator derived from the centralized SECRET_KEYS list.

import { SECRET_KEYS } from '@caracalai/core'

/**
 * Build Pino `redact.paths` patterns covering common HTTP-style log shapes
 * (request/response headers, body, query) for every centralized secret key.
 * Each pattern uses Pino's bracket notation with a wildcard so casing variants
 * inside log payloads are still censored.
 */
export function buildPinoRedactPaths(): string[] {
  const containers = [
    'req.headers',
    'request.headers',
    'res.headers',
    'response.headers',
    'req.body',
    'request.body',
    'req.query',
    'request.query',
  ]
  const paths = new Set<string>()
  for (const k of SECRET_KEYS) {
    for (const c of containers) {
      paths.add(`${c}["${k}"]`)
      paths.add(`${c}["${k.toUpperCase()}"]`)
    }
  }
  return Array.from(paths)
}
