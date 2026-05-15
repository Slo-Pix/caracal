// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the interactive CLI shell: TTY requirement, command dispatch, builtins, and unknown-command rejection.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { PassThrough } from 'node:stream'
import { startRepl } from '../../../../apps/cli/src/repl.ts'
import { buildRegistry, type Executor } from '../../../../apps/cli/src/registry.ts'
import { CLI_COMMANDS } from '../../../../packages/core/ts/src/commands.ts'
import type { DispatchOptions } from '../../../../apps/cli/src/dispatcher.ts'

function makeOptions(run: Executor): DispatchOptions {
  const executors = Object.fromEntries(CLI_COMMANDS.map((c) => [c.name, run]))
  const registry = buildRegistry(CLI_COMMANDS, executors)
  return { binary: 'caracal cli', version: '0.0.0', mode: 'dev', registry }
}

afterEach(() => { vi.restoreAllMocks() })

describe('repl', () => {
  it('refuses to start without a TTY and exits 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit:${c}`) }) as never)
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false })
    await expect(startRepl({ dispatchOptions: makeOptions(vi.fn() as Executor) })).rejects.toThrow('exit:1')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('routes known commands, ignores blank lines, and exits on `exit`', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    Object.defineProperty(input, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(output, 'isTTY', { configurable: true, value: true })
    const origStdin = process.stdin
    const origStdout = process.stdout
    Object.defineProperty(process, 'stdin', { configurable: true, value: input })
    Object.defineProperty(process, 'stdout', { configurable: true, value: output })

    const run = vi.fn() as Executor
    const promise = startRepl({ dispatchOptions: makeOptions(run) })
    input.write('\n')
    input.write('zone list --json\n')
    input.write('exit\n')
    input.end()
    await promise

    Object.defineProperty(process, 'stdin', { configurable: true, value: origStdin })
    Object.defineProperty(process, 'stdout', { configurable: true, value: origStdout })

    expect(run).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith(['list', '--json'], undefined)
  })
})
