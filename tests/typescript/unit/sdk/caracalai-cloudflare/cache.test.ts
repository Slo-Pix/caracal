// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// IsolateSafeTokenCache unit tests: isolation, expiry, no cross-subject leakage.

import { describe, it, expect, beforeEach } from 'vitest'
import { IsolateSafeTokenCache } from '../../../../../packages/caracalai-cloudflare/src/cache.js'

describe('IsolateSafeTokenCache', () => {
  let cache: IsolateSafeTokenCache

  beforeEach(() => {
    cache = new IsolateSafeTokenCache()
  })

  it('returns undefined for unknown entry', () => {
    expect(cache.get('subject-a', 'resource://api')).toBeUndefined()
  })

  it('stores and retrieves a valid token', () => {
    cache.set('subject-a', 'resource://api', 'tok-1', 900)
    expect(cache.get('subject-a', 'resource://api')).toBe('tok-1')
  })

  it('evicts expired token', () => {
    // Set with 0 seconds TTL — already expired
    cache.set('subject-a', 'resource://api', 'tok-expired', 0)
    expect(cache.get('subject-a', 'resource://api')).toBeUndefined()
  })

  it('does not serve subject-A token to subject-B', () => {
    cache.set('subject-a', 'resource://api', 'tok-a', 900)
    cache.set('subject-b', 'resource://api', 'tok-b', 900)
    expect(cache.get('subject-a', 'resource://api')).toBe('tok-a')
    expect(cache.get('subject-b', 'resource://api')).toBe('tok-b')
    expect(cache.get('subject-a', 'resource://api')).not.toBe('tok-b')
  })

  it('does not share across resources for the same subject', () => {
    cache.set('subject-a', 'resource://r1', 'tok-r1', 900)
    cache.set('subject-a', 'resource://r2', 'tok-r2', 900)
    expect(cache.get('subject-a', 'resource://r1')).toBe('tok-r1')
    expect(cache.get('subject-a', 'resource://r2')).toBe('tok-r2')
  })

  it('overwrites on second set', () => {
    cache.set('subject-a', 'resource://api', 'tok-old', 900)
    cache.set('subject-a', 'resource://api', 'tok-new', 900)
    expect(cache.get('subject-a', 'resource://api')).toBe('tok-new')
  })
})
