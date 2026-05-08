// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Cloudflare JWT validation tests for JWKS lookup and claim enforcement.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateJwt } from '../../../../../packages/runtime-adaptor/cloudflare/ts/src/jwks.js'

describe('validateJwt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates ES256 tokens and reuses cached JWKS keys', async () => {
    const { token, jwk } = await mintToken({ zone_id: 'zone1', scope: 'read' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [jwk] }) })
    vi.stubGlobal('fetch', fetchMock)

    const first = await validateJwt(token, 'https://sts.example.com/.well-known/jwks.json', 'resource://api', 'https://sts.example.com', 'zone1')
    const second = await validateJwt(token, 'https://sts.example.com/.well-known/jwks.json', 'resource://api', 'https://sts.example.com', 'zone1')

    expect(first.sub).toBe('user1')
    expect(second.scope).toBe('read')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects tokens for the wrong audience before signature lookup', async () => {
    const { token, jwk } = await mintToken({ aud: 'resource://other', zone_id: 'zone1' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [jwk] }) }))

    await expect(validateJwt(token, 'https://sts.example.com/.well-known/jwks.json', 'resource://api', 'https://sts.example.com'))
      .rejects.toThrow('Invalid audience')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects missing or mismatched zone claims', async () => {
    const missing = await mintToken({ zone_id: undefined })
    const mismatch = await mintToken({ zone_id: 'zone2' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [missing.jwk, mismatch.jwk] }) }))

    await expect(validateJwt(missing.token, 'https://sts.example.com/.well-known/jwks.json', 'resource://api', 'https://sts.example.com'))
      .rejects.toThrow('Invalid zone')
    await expect(validateJwt(mismatch.token, 'https://sts.example.com/.well-known/jwks.json', 'resource://api', 'https://sts.example.com', 'zone1'))
      .rejects.toThrow('Invalid zone')
  })
})

async function mintToken(overrides: Record<string, unknown>): Promise<{ token: string; jwk: JsonWebKey }> {
  const key = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const header = { alg: 'ES256', kid: 'kid1', typ: 'JWT' }
  const payload: Record<string, unknown> = {
    iss: 'https://sts.example.com',
    aud: 'resource://api',
    sub: 'user1',
    exp: Math.floor(Date.now() / 1000) + 900,
    zone_id: 'zone1',
    ...overrides,
  }
  const headerB64 = base64URL(JSON.stringify(header))
  const payloadB64 = base64URL(JSON.stringify(payload))
  const input = `${headerB64}.${payloadB64}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key.privateKey,
    new TextEncoder().encode(input),
  )
  const jwk = await crypto.subtle.exportKey('jwk', key.publicKey)
  jwk.kid = 'kid1'
  jwk.alg = 'ES256'
  jwk.use = 'sig'
  return { token: `${input}.${base64URL(new Uint8Array(signature))}`, jwk }
}

function base64URL(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}