// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TypeScript MCP JWKS cache unit tests for fetch and cache behavior.

import { describe, expect, it, vi } from 'vitest'
import { getKeySet } from '../../../../../packages/caracalai-mcp/src/jwks.js'

describe('getKeySet', () => {
  it('fetches JWKS from the issuer well-known endpoint', async () => {
    const issuer = 'https://issuer-one.example/'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    const keySet = await getKeySet(issuer)

    expect(typeof keySet).toBe('function')
    expect(fetchMock).toHaveBeenCalledWith('https://issuer-one.example/.well-known/jwks.json')
  })

  it('reuses cached key sets for the same issuer', async () => {
    const issuer = 'https://issuer-two.example'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    const first = await getKeySet(issuer)
    const second = await getKeySet(issuer)

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects failed JWKS fetches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    await expect(getKeySet('https://issuer-three.example')).rejects.toThrow('JWKS fetch failed: 503')
  })
})