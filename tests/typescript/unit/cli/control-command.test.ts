// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the secured Control CLI command entry.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { controlCommand } from '../../../../apps/cli/src/commands/control.ts'

const originalEnv = { ...process.env }
const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
  restoreDescriptor(process.stdin, 'isTTY', stdinTty)
  restoreDescriptor(process.stdout, 'isTTY', stdoutTty)
})

function restoreDescriptor(target: NodeJS.ReadStream | NodeJS.WriteStream, key: 'isTTY', descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(target, key, descriptor)
  else delete (target as { isTTY?: boolean }).isTTY
}

function writeAdminToken(token = 'local-control-admin-token'): string {
  const home = mkdtempSync(join(tmpdir(), 'caracal-control-home-'))
  const secrets = join(home, 'secrets')
  mkdirSync(secrets, { recursive: true })
  writeFileSync(join(secrets, 'caracalAdminToken'), token, { mode: 0o600 })
  process.env.CARACAL_HOME = home
  return token
}

function setTty(stdin: boolean, stdout: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: stdin })
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: stdout })
}

function mockExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code ?? 0}`)
  }) as never)
}

describe('controlCommand', () => {
  it('allows Control management through the interactive shell CLI dispatch path', async () => {
    process.env = { ...originalEnv, CARACAL_INVOKED_AS: 'caracal cli' }
    writeAdminToken()
    process.env.CARACAL_MODE = 'stable'
    setTty(true, true)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await controlCommand(['status'])

    expect(stdout.mock.calls.map((call) => call[0]).join('')).toContain('Control:')
  })

  it('rejects Control lifecycle status outside an interactive terminal', async () => {
    process.env = { ...originalEnv }
    writeAdminToken()
    setTty(false, true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const exit = mockExit()

    await expect(controlCommand(['status'])).rejects.toThrow('exit:1')
    expect(exit).toHaveBeenCalledWith(1)
    expect(stderr.mock.calls.map((call) => call[0]).join('')).toContain('authenticated interactive CLI or TUI session')
  })

  it('rejects Control lifecycle status when the configured admin token does not match the managed secret', async () => {
    process.env = { ...originalEnv, CARACAL_ADMIN_TOKEN: 'wrong-token' }
    writeAdminToken('managed-token')
    setTty(true, true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const exit = mockExit()

    await expect(controlCommand(['status'])).rejects.toThrow('exit:1')
    expect(exit).toHaveBeenCalledWith(1)
    expect(stderr.mock.calls.map((call) => call[0]).join('')).toContain('admin token does not match')
  })

  it('allows Control lifecycle status from an authenticated interactive CLI session', async () => {
    process.env = { ...originalEnv }
    writeAdminToken()
    process.env.CARACAL_MODE = 'stable'
    setTty(true, true)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await controlCommand(['status'])

    expect(stdout.mock.calls.map((call) => call[0]).join('')).toContain('Control:')
  })

  it('rejects structured output for lifecycle mutations', async () => {
    process.env = { ...originalEnv }
    writeAdminToken()
    setTty(true, true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const exit = mockExit()

    await expect(controlCommand(['enable', '--json'])).rejects.toThrow('exit:1')
    expect(exit).toHaveBeenCalledWith(1)
    expect(stderr.mock.calls.map((call) => call[0]).join('')).toContain('lifecycle changes are interactive only')
  })
})
