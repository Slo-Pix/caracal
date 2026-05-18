// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Drift guard: every ${VAR:-default} substitution in docker-compose.yml must mirror the schema default for the active mode.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENV_SCHEMA, envEntries, resolveDefault } from '../../../../packages/engine/src/envSchema.ts'

const repoRoot = resolve(__dirname, '..', '..', '..', '..')

function extractSubs(yaml: string): Map<string, string> {
  const subs = new Map<string, string>()
  const re = /\$\{([A-Z_][A-Z0-9_]*):-([^${}][^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(yaml)) !== null) {
    const key = m[1]
    const def = m[2]
    if (!subs.has(key)) subs.set(key, def)
  }
  return subs
}

describe('docker-compose default substitutions', () => {
  it('every ${VAR:-default} in docker-compose.yml matches the dev schema default', () => {
    const yaml = readFileSync(resolve(repoRoot, 'infra', 'docker', 'docker-compose.yml'), 'utf8')
    const subs = extractSubs(yaml)
    const mismatches: string[] = []
    for (const [key, def] of subs) {
      if (!(key in ENV_SCHEMA)) continue
      const spec = ENV_SCHEMA[key as keyof typeof ENV_SCHEMA]
      if (spec.secret) continue
      const schemaDef = resolveDefault(spec, 'dev')
      if (schemaDef === undefined) continue
      if (def !== schemaDef) mismatches.push(`${key}: compose=${def} schema=${schemaDef}`)
    }
    expect(mismatches).toEqual([])
  })

  it('compose never inlines defaults for secrets', () => {
    const yaml = readFileSync(resolve(repoRoot, 'infra', 'docker', 'docker-compose.yml'), 'utf8')
    const subs = extractSubs(yaml)
    for (const [key, spec] of envEntries()) {
      if (!spec.secret) continue
      expect(subs.has(key)).toBe(false)
    }
  })
})
