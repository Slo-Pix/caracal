// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// In-memory revocation store unit tests.

import { describe, expect, it, vi } from 'vitest'
import { InMemoryRevocationStore } from '../../../../packages/revocation/ts/src/index.js'

describe('InMemoryRevocationStore', () => {
  it('marks sessions revoked until ttl expiry', () => {
    vi.useFakeTimers()
    try {
      const store = new InMemoryRevocationStore({ defaultTtlMs: 1_000 })
      store.markRevoked('sid-1')
      expect(store.isRevoked('sid-1')).toBe(true)
      vi.advanceTimersByTime(1_001)
      expect(store.isRevoked('sid-1')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails closed when capacity is exhausted', () => {
    const store = new InMemoryRevocationStore({ maxEntries: 2 })
    store.markRevoked('sid-1')
    store.markRevoked('sid-2')
    expect(() => store.markRevoked('sid-3')).toThrow('capacity exceeded')
    expect(store.isRevoked('sid-1')).toBe(true)
    expect(store.isRevoked('sid-2')).toBe(true)
  })

  it('reaps expired entries to make room under capacity pressure', () => {
    vi.useFakeTimers()
    try {
      const store = new InMemoryRevocationStore({ maxEntries: 2, defaultTtlMs: 1_000 })
      store.markRevoked('sid-1')
      store.markRevoked('sid-2')
      vi.advanceTimersByTime(1_001)
      store.markRevoked('sid-3')
      expect(store.isRevoked('sid-3')).toBe(true)
      expect(store.size()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tracks monotonically increasing delegation epochs until ttl expiry', () => {
    vi.useFakeTimers()
    try {
      const store = new InMemoryRevocationStore({ defaultTtlMs: 1_000 })

      expect(store.currentDelegationEpoch('zone-1')).toBe(0)
      store.markDelegationEpoch('zone-1', 5)
      store.markDelegationEpoch('zone-1', 4)
      store.markDelegationEpoch('zone-1', 5)

      expect(store.currentDelegationEpoch('zone-1')).toBe(5)
      store.markDelegationEpoch('zone-1', 6, 500)
      expect(store.currentDelegationEpoch('zone-1')).toBe(6)
      vi.advanceTimersByTime(501)
      expect(store.currentDelegationEpoch('zone-1')).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses explicit revocation ttls and keeps independent store sizes', () => {
    vi.useFakeTimers()
    try {
      const store = new InMemoryRevocationStore({ defaultTtlMs: 10_000 })
      store.markRevoked('sid-short', 100)
      store.markDelegationEpoch('zone-1', 9)

      expect(store.size()).toBe(1)
      expect(store.currentDelegationEpoch('zone-1')).toBe(9)
      vi.advanceTimersByTime(101)

      expect(store.isRevoked('sid-short')).toBe(false)
      expect(store.size()).toBe(0)
      expect(store.currentDelegationEpoch('zone-1')).toBe(9)
    } finally {
      vi.useRealTimers()
    }
  })
})
