// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for per-subject token-bucket rate limiter.

import { describe, it, expect } from 'vitest'
import { RateLimiter } from '../../../../apps/control/src/ratelimit.js'

describe('RateLimiter', () => {
  it('allows up to capacity then rejects', () => {
    const r = new RateLimiter(3, 60_000)
    expect(r.allow('s1')).toBe(true)
    expect(r.allow('s1')).toBe(true)
    expect(r.allow('s1')).toBe(true)
    expect(r.allow('s1')).toBe(false)
  })

  it('isolates buckets per subject', () => {
    const r = new RateLimiter(1, 60_000)
    expect(r.allow('a')).toBe(true)
    expect(r.allow('a')).toBe(false)
    expect(r.allow('b')).toBe(true)
  })

  it('rejects an empty subject', () => {
    const r = new RateLimiter(10, 60_000)
    expect(r.allow('')).toBe(false)
  })
})
