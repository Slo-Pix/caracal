// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for runtime stack command Docker Compose preflight handling.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const engineMocks = vi.hoisted(() => ({
  defaultServiceProbes: vi.fn(() => []),
  resolveStackPaths: vi.fn(),
  stackDown: vi.fn(),
  stackStatus: vi.fn(),
  stackUp: vi.fn(),
}))

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync: spawnSyncMock,
}))

vi.mock('@caracalai/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@caracalai/engine')>()
  return { ...actual, ...engineMocks }
})

import { downCommand, upCommand } from '../../../../apps/runtime/src/commands/stack.ts'

describe('stack commands', () => {
  let stderr = ''

  beforeEach(() => {
    vi.clearAllMocks()
    stderr = ''
    engineMocks.resolveStackPaths.mockReturnValue({
      mode: 'dev',
      composeFile: '/tmp/caracal/docker-compose.yml',
      envFiles: [],
      cwd: '/tmp/caracal',
    })
    engineMocks.stackDown.mockReturnValue({ dispose: vi.fn(), exitCode: Promise.resolve(0) })
    engineMocks.stackUp.mockReturnValue({ dispose: vi.fn(), exitCode: Promise.resolve(0) })
    spawnSyncMock.mockReturnValue({ status: 0 })
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr += chunk.toString()
      return true
    })
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`)
    }) as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fails up before spawning when Docker Compose is unavailable', async () => {
    spawnSyncMock.mockReturnValue({ status: 127 })

    await expect(upCommand([])).rejects.toThrow('exit:1')

    expect(stderr).toContain('docker compose is not available; install Docker with the Compose plugin or add docker to PATH')
    expect(engineMocks.stackUp).not.toHaveBeenCalled()
  })

  it('fails down before spawning when Docker Compose is unavailable', async () => {
    spawnSyncMock.mockReturnValue({ status: 127 })

    await expect(downCommand([])).rejects.toThrow('exit:1')

    expect(stderr).toContain('docker compose is not available; install Docker with the Compose plugin or add docker to PATH')
    expect(engineMocks.stackDown).not.toHaveBeenCalled()
  })

  it('runs up when Docker Compose is available', async () => {
    await expect(upCommand(['api'])).rejects.toThrow('exit:0')

    expect(engineMocks.stackUp).toHaveBeenCalledWith(expect.objectContaining({ args: ['api'] }))
  })
})
