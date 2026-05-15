// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Pino redact-path generator derived from the centralized SECRET_KEYS list.

import { SECRET_KEYS } from '@caracalai/core'

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
