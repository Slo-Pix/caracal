// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CLI status command unit tests for service health reporting.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { statusCommand } from '../../../../apps/cli/src/commands/stack.js'

describe('statusCommand', () => {
  let stdout = ''

  beforeEach(() => {
    stdout = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString()
      return true
    })
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exits zero when all service probes are healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    await expect(statusCommand()).rejects.toThrow('exit:0')

    expect(stdout).toContain('api           3000  ok')
    expect(stdout).toContain('coordinator   4000  ok')
  })

  it('exits nonzero and marks down services when a probe fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockRejectedValueOnce(new Error('connect refused'))
      .mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(statusCommand()).rejects.toThrow('exit:1')

    expect(stdout).toContain('api           3000  ok')
    expect(stdout).toContain('sts           8080  down  unreachable')
  })
})