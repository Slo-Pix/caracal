// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for stack mode path resolution.

import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePaths } from '../../../../apps/cli/src/commands/stack.ts'

function repoFixture(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'caracal-repo-'))
  const dockerDir = join(repoRoot, 'infra', 'docker')
  mkdirSync(dockerDir, { recursive: true })
  writeFileSync(join(dockerDir, 'docker-compose.yml'), 'name: caracal\n')
  writeFileSync(join(dockerDir, '.env'), 'POSTGRES_PASSWORD=test\n')
  return repoRoot
}

describe('resolvePaths', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses dev mode for a source checkout even when CARACAL_HOME is set', () => {
    const repoRoot = repoFixture()
    vi.stubEnv('INIT_CWD', repoRoot)
    vi.stubEnv('PWD', repoRoot)
    vi.stubEnv('CARACAL_HOME', mkdtempSync(join(tmpdir(), 'caracal-home-')))

    const paths = resolvePaths()

    expect(paths.mode).toBe('dev')
    expect(paths.cwd).toBe(repoRoot)
    expect(paths.composeFile).toBe(join(repoRoot, 'infra', 'docker', 'docker-compose.yml'))
  })

  it('uses runtime mode only when explicitly requested', () => {
    const repoRoot = repoFixture()
    const home = mkdtempSync(join(tmpdir(), 'caracal-home-'))
    vi.stubEnv('INIT_CWD', repoRoot)
    vi.stubEnv('PWD', repoRoot)
    vi.stubEnv('CARACAL_HOME', home)
    vi.stubEnv('CARACAL_STACK_MODE', 'runtime')

    const paths = resolvePaths()

    expect(paths.mode).toBe('runtime')
    expect(paths.cwd).toBe(home)
    expect(paths.composeFile).toBe(join(home, 'compose.yml'))
  })
})
