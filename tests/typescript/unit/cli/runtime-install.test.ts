// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the runtime asset installer.

import { mkdtempSync, readFileSync, statSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { installRuntimeAssets, runtimePaths } from '../../../../packages/engine/dist/index.js'

describe('runtime installer', () => {
  it('writes compose and operator template with secure modes', () => {
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

    const env = readFileSync(paths.overrideEnvFile, 'utf8')
    expect(env).not.toMatch(/^POSTGRES_PASSWORD=/m)
    expect(env).not.toMatch(/^REDIS_PASSWORD=/m)
    expect(env).not.toMatch(/^CARACAL_ADMIN_TOKEN=/m)
    for (const line of env.split('\n')) {
      if (line.trim() === '' || line.startsWith('#')) continue
      throw new Error(`uncommented entry in operator template: ${line}`)
    }

    const envMode = statSync(paths.overrideEnvFile).mode & 0o777
    expect(envMode).toBe(0o600)
  })

  it('is idempotent: existing files are preserved', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const paths = runtimePaths(home)
    installRuntimeAssets(paths)
    const envBefore = readFileSync(paths.overrideEnvFile, 'utf8')
    const second = installRuntimeAssets(paths)
    expect(second.created).toBe(false)
    expect(readFileSync(paths.overrideEnvFile, 'utf8')).toBe(envBefore)
  })

  it('tightens permissions on a pre-existing world-readable env file', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const paths = runtimePaths(home)
    mkdirSync(paths.home, { recursive: true })
    writeFileSync(paths.overrideEnvFile, '# operator overrides\n')
    chmodSync(paths.overrideEnvFile, 0o644)
    expect(statSync(paths.overrideEnvFile).mode & 0o777).toBe(0o644)
    installRuntimeAssets(paths)
    expect(statSync(paths.overrideEnvFile).mode & 0o777).toBe(0o600)
  })

  it('writes mode-specific operator templates that differ between rc and stable banners', () => {
    const homeRc = mkdtempSync(join(tmpdir(), 'caracal-runtime-rc-'))
    const homeStable = mkdtempSync(join(tmpdir(), 'caracal-runtime-stable-'))
    installRuntimeAssets(runtimePaths(homeRc), 'rc')
    installRuntimeAssets(runtimePaths(homeStable), 'stable')
    const rc = readFileSync(join(homeRc, 'caracal.env'), 'utf8')
    const stable = readFileSync(join(homeStable, 'caracal.env'), 'utf8')
    expect(rc).toContain('Caracal rc stack')
    expect(stable).toContain('Caracal stable stack')
    expect(rc).not.toBe(stable)
  })

  it('bootstraps secret files under home/secrets with 0o444 mode', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const result = installRuntimeAssets(runtimePaths(home))
    expect(result.filesCreated.length).toBeGreaterThan(0)
    for (const name of ['postgresPassword', 'redisPassword', 'caracalAdminToken', 'zoneKek']) {
      const secretPath = join(home, 'secrets', name)
      expect(statSync(secretPath).mode & 0o777).toBe(0o444)
      const value = readFileSync(secretPath, 'utf8').trim()
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('compose file never references secret material directly', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-runtime-'))
    const paths = runtimePaths(home)
    installRuntimeAssets(paths)
    const compose = readFileSync(paths.composeFile, 'utf8')
    for (const tail of ['POSTGRES_PASSWORD:', 'REDIS_PASSWORD:', 'CARACAL_ADMIN_TOKEN:']) {
      expect(compose).not.toContain(`\n      ${tail} `)
    }
    expect(compose).toMatch(/POSTGRES_PASSWORD_FILE/)
  })
})
