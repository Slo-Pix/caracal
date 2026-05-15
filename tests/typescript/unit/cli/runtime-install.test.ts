// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the runtime asset installer.

import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { installRuntimeAssets, runtimePaths } from '../../../../apps/cli/src/runtime/install.ts'

describe('runtime installer', () => {
  it('writes compose and env with secrets and correct modes', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const paths = runtimePaths(home)
    const result = installRuntimeAssets(paths)

    expect(result.created).toBe(true)

    const compose = readFileSync(paths.composeFile, 'utf8')
    expect(compose).toContain('caracal-api:v${CARACAL_VERSION}')
    for (const port of ['5432', '6379', '8080', '3000', '8081', '9090', '4000']) {
      expect(compose).toContain(`"127.0.0.1:${port}:${port}"`)
      expect(compose).not.toMatch(new RegExp(`^\\s*-\\s*"${port}:${port}"`, 'm'))
    }

    const env = readFileSync(paths.envFile, 'utf8')
    expect(env).toMatch(/POSTGRES_PASSWORD=[A-Za-z0-9_-]{20,}/)
    expect(env).toMatch(/REDIS_PASSWORD=[A-Za-z0-9_-]{20,}/)
    expect(env).toMatch(/CARACAL_ADMIN_TOKEN=[A-Za-z0-9_-]{20,}/)

    const envMode = statSync(paths.envFile).mode & 0o777
    expect(envMode).toBe(0o600)
  })

  it('is idempotent: existing files are preserved', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const paths = runtimePaths(home)
    installRuntimeAssets(paths)
    const envBefore = readFileSync(paths.envFile, 'utf8')
    const second = installRuntimeAssets(paths)
    expect(second.created).toBe(false)
    expect(readFileSync(paths.envFile, 'utf8')).toBe(envBefore)
  })

  it('tightens permissions on a pre-existing world-readable env file', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const paths = runtimePaths(home)
    mkdirSync(paths.home, { recursive: true })
    writeFileSync(paths.envFile, 'POSTGRES_PASSWORD=preexisting\n')
    chmodSync(paths.envFile, 0o644)
    expect(statSync(paths.envFile).mode & 0o777).toBe(0o644)
    installRuntimeAssets(paths)
    expect(statSync(paths.envFile).mode & 0o777).toBe(0o600)
  })
})
