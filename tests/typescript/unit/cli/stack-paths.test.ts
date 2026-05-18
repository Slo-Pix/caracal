// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for stack mode path resolution and env-file layering.

import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePaths } from '../../../../apps/cli/src/commands/stack.ts'

function repoFixture(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'caracal-repo-'))
  const dockerDir = join(repoRoot, 'infra', 'docker')
  mkdirSync(dockerDir, { recursive: true })
  writeFileSync(join(dockerDir, 'docker-compose.yml'), 'name: caracal\n')
  writeFileSync(join(dockerDir, 'dev.env'), 'CARACAL_MODE=dev\n')
  return repoRoot
}

describe('resolvePaths', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses dev mode and points envFiles at dev.env when no local.env exists', () => {
    const repoRoot = repoFixture()
    vi.stubEnv('CARACAL_MODE', 'dev')
    vi.stubEnv('CARACAL_REPO_ROOT', repoRoot)

    const paths = resolvePaths()

    expect(paths.mode).toBe('dev')
    expect(paths.cwd).toBe(repoRoot)
    expect(paths.composeFile).toBe(join(repoRoot, 'infra', 'docker', 'docker-compose.yml'))
    expect(paths.envFiles).toEqual([join(repoRoot, 'infra', 'docker', 'dev.env')])
  })

  it('includes local.env in envFiles when present (dev.env first, local.env second)', () => {
    const repoRoot = repoFixture()
    writeFileSync(join(repoRoot, 'infra', 'docker', 'local.env'), 'LOG_LEVEL=debug\n')
    vi.stubEnv('CARACAL_MODE', 'dev')
    vi.stubEnv('CARACAL_REPO_ROOT', repoRoot)

    const paths = resolvePaths()

    expect(paths.envFiles).toEqual([
      join(repoRoot, 'infra', 'docker', 'dev.env'),
      join(repoRoot, 'infra', 'docker', 'local.env'),
    ])
  })

  it('uses stable mode and resolves a single operator override env file', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-home-'))
    vi.stubEnv('CARACAL_MODE', 'stable')
    vi.stubEnv('CARACAL_HOME', home)

    const paths = resolvePaths()

    expect(paths.mode).toBe('stable')
    expect(paths.cwd).toBe(home)
    expect(paths.composeFile).toBe(join(home, 'compose.yml'))
    expect(paths.envFiles).toEqual([join(home, 'caracal.env')])
    expect(existsSync(join(home, 'caracal.env'))).toBe(true)
  })

  it('rc mode resolves the same layout as stable', () => {
    const home = mkdtempSync(join(tmpdir(), 'caracal-home-'))
    vi.stubEnv('CARACAL_MODE', 'rc')
    vi.stubEnv('CARACAL_HOME', home)

    const paths = resolvePaths()

    expect(paths.mode).toBe('rc')
    expect(paths.envFiles).toEqual([join(home, 'caracal.env')])
  })
})
