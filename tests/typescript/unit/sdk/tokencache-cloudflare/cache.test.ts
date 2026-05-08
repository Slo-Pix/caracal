// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// IsolateSafeTokenCache unit tests: isolation, expiry, no cross-subject leakage.

import { describe, it, expect, beforeEach } from 'vitest'
import { IsolateSafeTokenCache } from '../../../../../packages/state-backend/tokencache-cloudflare/ts/src/cache.js'
import type { TokenExchangeResponse } from '../../../../../packages/oauth/ts/src/types.js'

function makeToken(accessToken: string, expiresIn: number, issuedAt?: number): TokenExchangeResponse {
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    issuedAt: issuedAt ?? Math.floor(Date.now() / 1000),
  }
}

describe('IsolateSafeTokenCache', () => {
  let cache: IsolateSafeTokenCache

  beforeEach(() => {
    cache = new IsolateSafeTokenCache()
  })

  it('returns undefined for unknown entry', () => {
    expect(cache.get('subject-a', 'resource://api')).toBeUndefined()
  })

  it('stores and retrieves a valid token', () => {
    const token = makeToken('tok-1', 900)
    cache.set('subject-a', 'resource://api', token)
    expect(cache.get('subject-a', 'resource://api')).toBe(token)
  })

  it('evicts expired token', () => {
    const expired = makeToken('tok-expired', 1, Math.floor(Date.now() / 1000) - 10)
    cache.set('subject-a', 'resource://api', expired)
    expect(cache.get('subject-a', 'resource://api')).toBeUndefined()
  })

  it('does not serve subject-A token to subject-B', () => {
    const tokenA = makeToken('tok-a', 900)
    const tokenB = makeToken('tok-b', 900)
    cache.set('subject-a', 'resource://api', tokenA)
    cache.set('subject-b', 'resource://api', tokenB)
    expect(cache.get('subject-a', 'resource://api')).toBe(tokenA)
    expect(cache.get('subject-b', 'resource://api')).toBe(tokenB)
    expect(cache.get('subject-a', 'resource://api')).not.toBe(tokenB)
  })

  it('does not share across resources for the same subject', () => {
    const tokenR1 = makeToken('tok-r1', 900)
    const tokenR2 = makeToken('tok-r2', 900)
    cache.set('subject-a', 'resource://r1', tokenR1)
    cache.set('subject-a', 'resource://r2', tokenR2)
    expect(cache.get('subject-a', 'resource://r1')).toBe(tokenR1)
    expect(cache.get('subject-a', 'resource://r2')).toBe(tokenR2)
  })

  it('overwrites on second set', () => {
    const first = makeToken('tok-old', 900)
    const second = makeToken('tok-new', 900)
    cache.set('subject-a', 'resource://api', first)
    cache.set('subject-a', 'resource://api', second)
    expect(cache.get('subject-a', 'resource://api')).toBe(second)
  })
})
