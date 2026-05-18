// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for stack lifecycle docker compose command construction.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StackPaths } from '../../../../packages/engine/src/stack.ts'

const runExecMock = vi.hoisted(() => vi.fn())
const controlEnabledMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('../../../../packages/engine/src/run.js', () => ({
  runExec: runExecMock,
}))

vi.mock('../../../../packages/engine/src/controlState.js', () => ({
  isControlEnabled: controlEnabledMock,
}))

import { composeRun, defaultServiceProbes, stackDown, stackUp } from '../../../../packages/engine/src/stack.ts'

let dir: string
let calls: Array<{ argv: string[]; env?: Record<string, string | undefined>; cwd?: string }>

function paths(mode: StackPaths['mode'], envFiles: string[]): StackPaths {
  return {
    composeFile: join(dir, `${mode}.yml`),
    envFiles,
    cwd: dir,
    mode,
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'caracal-stack-'))
  calls = []
  runExecMock.mockImplementation((opts: { argv: string[]; env?: Record<string, string | undefined>; cwd?: string }) => {
    calls.push({ argv: opts.argv, env: opts.env, cwd: opts.cwd })
    return { dispose: vi.fn(), exitCode: Promise.resolve(0) }
  })
  controlEnabledMock.mockReturnValue(false)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  runExecMock.mockReset()
  controlEnabledMock.mockReset()
  delete process.env.CONTROL_PORT
})

describe('stack lifecycle compose commands', () => {
  it('starts dev stacks with build and removes one-shot containers after success', async () => {
    const devEnv = join(dir, 'dev.env')
    const localEnv = join(dir, 'local.env')
    writeFileSync(devEnv, 'CARACAL_MODE=dev\n')
    writeFileSync(localEnv, 'LOG_LEVEL=debug\n')

    const handle = stackUp({
      paths: paths('dev', [devEnv, localEnv]),
      args: ['api'],
      env: { CARACAL_MODE: 'dev', CARACAL_DEV_SHA: 'abc123' },
    })
    await expect(handle.exitCode).resolves.toBe(0)

    expect(calls[0]).toEqual({
      argv: [
        'docker',
        'compose',
        '--env-file',
        devEnv,
        '--env-file',
        localEnv,
        '-f',
        join(dir, 'dev.yml'),
        'up',
        '-d',
        '--build',
        '--remove-orphans',
        'api',
      ],
      env: { CARACAL_MODE: 'dev', CARACAL_DEV_SHA: 'abc123' },
      cwd: dir,
    })
    expect(calls[1].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      devEnv,
      '--env-file',
      localEnv,
      '-f',
      join(dir, 'dev.yml'),
      'rm',
      '-f',
    ])
  })

  it('starts rc and stable stacks without build and skips missing env files', async () => {
    for (const mode of ['rc', 'stable'] as const) {
      calls = []
      const envFile = join(dir, `${mode}.env`)
      writeFileSync(envFile, `CARACAL_MODE=${mode}\n`)

      const handle = stackUp({
        paths: paths(mode, [envFile, join(dir, 'missing.env')]),
        args: [],
        env: { CARACAL_MODE: mode, CARACAL_VERSION: '1.0.0' },
      })
      await expect(handle.exitCode).resolves.toBe(0)

      expect(calls[0].argv).toEqual([
        'docker',
        'compose',
        '--env-file',
        envFile,
        '-f',
        join(dir, `${mode}.yml`),
        'up',
        '-d',
        '--remove-orphans',
      ])
      expect(calls[0].argv).not.toContain('--build')
      expect(calls[1].argv).toEqual([
        'docker',
        'compose',
        '--env-file',
        envFile,
        '-f',
        join(dir, `${mode}.yml`),
        'rm',
        '-f',
      ])
    }
  })

  it('does not remove one-shot containers when startup fails', async () => {
    runExecMock.mockImplementationOnce((opts: { argv: string[]; env?: Record<string, string | undefined>; cwd?: string }) => {
      calls.push({ argv: opts.argv, env: opts.env, cwd: opts.cwd })
      return { dispose: vi.fn(), exitCode: Promise.resolve(1) }
    })

    const handle = stackUp({ paths: paths('stable', []), args: [], env: { CARACAL_MODE: 'stable' } })

    await expect(handle.exitCode).resolves.toBe(1)
    expect(calls).toHaveLength(1)
  })

  it('stops stacks with operator env files and caller arguments', () => {
    const envFile = join(dir, 'caracal.env')
    writeFileSync(envFile, '# operator\n')

    stackDown({
      paths: paths('stable', [envFile]),
      args: ['--volumes'],
      env: { CARACAL_MODE: 'stable' },
    })

    expect(calls[0]).toEqual({
      argv: [
        'docker',
        'compose',
        '--env-file',
        envFile,
        '-f',
        join(dir, 'stable.yml'),
        'down',
        '--volumes',
      ],
      env: { CARACAL_MODE: 'stable' },
      cwd: dir,
    })
  })

  it('adds the control profile only when control runtime state is enabled', () => {
    controlEnabledMock.mockReturnValue(true)

    stackDown({ paths: paths('stable', []), args: [], env: { CARACAL_MODE: 'stable' } })

    expect(calls[0].argv).toEqual([
      'docker',
      'compose',
      '-f',
      join(dir, 'stable.yml'),
      '--profile',
      'control',
      'down',
    ])
  })

  it('filters absent env files through the filesystem boundary', () => {
    const envFile = join(dir, 'present.env')
    writeFileSync(envFile, 'LOG_LEVEL=info\n')

    stackDown({ paths: paths('dev', [join(dir, 'missing.env'), envFile]), args: [], env: {} })

    expect(existsSync(envFile)).toBe(true)
    expect(calls[0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      join(dir, 'dev.yml'),
      'down',
    ])
  })
})

describe('stack compose helpers', () => {
  it('composeRun includes the control profile only when control is enabled', async () => {
    const envFile = join(dir, 'caracal.env')
    writeFileSync(envFile, '# operator env\n')

    controlEnabledMock.mockReturnValueOnce(true)
    await composeRun({
      paths: paths('stable', [envFile]),
      args: ['ps'],
      env: { CARACAL_MODE: 'stable' },
    }).exitCode

    controlEnabledMock.mockReturnValueOnce(false)
    await composeRun({
      paths: paths('stable', [envFile]),
      args: ['ps'],
      env: { CARACAL_MODE: 'stable' },
    }).exitCode

    expect(calls[0].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      join(dir, 'stable.yml'),
      '--profile',
      'control',
      'ps',
    ])
    expect(calls[1].argv).toEqual([
      'docker',
      'compose',
      '--env-file',
      envFile,
      '-f',
      join(dir, 'stable.yml'),
      'ps',
    ])
  })

  it('defaultServiceProbes includes control only when runtime state is enabled', () => {
    process.env.CONTROL_PORT = '9100'
    controlEnabledMock.mockReturnValueOnce(true)
    const enabled = defaultServiceProbes('/tmp/home')
    expect(enabled.some((p) => p.name === 'control' && p.port === 9100)).toBe(true)

    controlEnabledMock.mockReturnValueOnce(false)
    const disabled = defaultServiceProbes('/tmp/home')
    expect(disabled.some((p) => p.name === 'control')).toBe(false)
    delete process.env.CONTROL_PORT
  })
})
