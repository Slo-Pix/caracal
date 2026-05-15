#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Generates per-environment secret files for compose-mounted Docker secrets and
// syncs the same values into infra/docker/.env so env-interpolated services and
// secret-mounted services agree on every credential.

import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, 'files')
const repoRoot = resolve(here, '..', '..')
const envPath = resolve(repoRoot, 'infra/docker/.env')
const envExamplePath = resolve(repoRoot, 'infra/docker/.env.example')
const isPosix = process.platform !== 'win32'

mkdirSync(dir, { recursive: true })
if (isPosix) chmodSync(dir, 0o700)

function readOrCreate(name, bytes) {
  const path = resolve(dir, name)
  try {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing.length > 0) {
      if (isPosix) chmodSync(path, 0o444)
      console.log(`skip ${name} (exists)`)
      return existing
    }
  } catch {}
  const value = randomBytes(bytes).toString('hex')
  writeFileSync(path, value, { mode: 0o444 })
  if (isPosix) chmodSync(path, 0o444)
  console.log(`wrote ${name}`)
  return value
}

const secrets = {
  POSTGRES_PASSWORD: readOrCreate('postgresPassword', 24),
  REDIS_PASSWORD: readOrCreate('redisPassword', 24),
  CARACAL_ADMIN_TOKEN: readOrCreate('caracalAdminToken', 32),
  ZONE_KEK: readOrCreate('zoneKek', 32),
  AUDIT_HMAC_KEY: readOrCreate('auditHmacKey', 32),
  STREAMS_HMAC_KEY: readOrCreate('streamsHmacKey', 32),
}

if (!existsSync(envPath)) {
  if (!existsSync(envExamplePath)) {
    console.error(`error: ${envPath} missing and no .env.example to seed from`)
    process.exit(1)
  }
  writeFileSync(envPath, readFileSync(envExamplePath, 'utf8'))
  console.log(`created infra/docker/.env from .env.example`)
}

const envLines = readFileSync(envPath, 'utf8').split('\n')
let mutated = false
for (const [key, value] of Object.entries(secrets)) {
  const re = new RegExp(`^${key}=(.*)$`)
  let found = false
  for (let i = 0; i < envLines.length; i++) {
    const m = envLines[i].match(re)
    if (!m) continue
    found = true
    if (m[1] === value) break
    envLines[i] = `${key}=${value}`
    mutated = true
    console.log(`synced ${key} → infra/docker/.env`)
    break
  }
  if (!found) {
    envLines.push(`${key}=${value}`)
    mutated = true
    console.log(`appended ${key} → infra/docker/.env`)
  }
}
if (mutated) writeFileSync(envPath, envLines.join('\n'))
if (isPosix) chmodSync(envPath, 0o600)

console.log('')
console.log(`secret files in ${dir}`)
console.log(`env synced at ${envPath}`)
console.log('they are gitignored; never commit')
