// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the sibling-binary executor used to dispatch `caracal cli` / `caracal tui` to their installed binaries.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { execSibling } from '../../../../apps/cli/src/commands/dispatch.ts'

afterEach(() => { vi.restoreAllMocks() })

describe('execSibling', () => {
  it('exits 127 with a hint when the sibling binary is not installed', () => {
    const origPath = process.env.PATH
    process.env.PATH = '/nonexistent-caracal-dir'
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit:${code ?? 0}`) }) as never)
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      expect(() => execSibling('caracal-nonexistent', [], { installLine: 'install hint' })).toThrow('exit:127')
      expect(exit).toHaveBeenCalledWith(127)
      const errOut = [...stderr.mock.calls, ...stdout.mock.calls].map((c) => String(c[0])).join('')
      expect(errOut).toContain('install hint')
    } finally {
      process.env.PATH = origPath
    }
  })
})
