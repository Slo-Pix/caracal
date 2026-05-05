// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// API service configuration loaded from environment variables.

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

function loadEnvChain(): void {
  const seen = new Set<string>()
  const candidates: string[] = []

  if (process.env.CARACAL_ENV_FILE) candidates.push(process.env.CARACAL_ENV_FILE)
  candidates.push(resolve(process.cwd(), '.env'))

  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth++) {
    candidates.push(join(dir, 'infra', 'docker', '.env'))
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  for (const path of candidates) {
    if (seen.has(path)) continue
    seen.add(path)
    if (existsSync(path)) loadEnvFile(path)
  }
}

loadEnvChain()

export interface Config {
  port: number
  databaseUrl: string
  redisUrl: string
  logLevel: string
  adminToken: string
}

function must(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`required env var missing: ${key}`)
  return v
}

function get(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const user = encodeURIComponent(must('POSTGRES_USER'))
  const password = encodeURIComponent(must('POSTGRES_PASSWORD'))
  const host = get('POSTGRES_HOST', 'localhost')
  const port = get('POSTGRES_PORT', '5432')
  const db = must('POSTGRES_DB')
  return `postgres://${user}:${password}@${host}:${port}/${db}`
}

function buildRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  const password = encodeURIComponent(must('REDIS_PASSWORD'))
  const host = get('REDIS_HOST', 'localhost')
  const port = get('REDIS_PORT', '6379')
  return `redis://:${password}@${host}:${port}`
}

export function loadConfig(): Config {
  return {
    port: parseInt(get('PORT', '3000'), 10),
    databaseUrl: buildDatabaseUrl(),
    redisUrl: buildRedisUrl(),
    logLevel: get('LOG_LEVEL', 'info'),
    adminToken: must('CARACAL_ADMIN_TOKEN'),
  }
}
