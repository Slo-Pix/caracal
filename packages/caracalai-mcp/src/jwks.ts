// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JWKS cache with 5-min TTL and stale-while-revalidate.

import { createLocalJWKSet, type JWTVerifyGetKey } from 'jose'

interface JwksEntry {
  keySet: JWTVerifyGetKey
  fetchedAt: number
  revalidating: boolean
}

const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map<string, JwksEntry>()

export async function getKeySet(issuer: string): Promise<JWTVerifyGetKey> {
  const now = Date.now()
  const entry = cache.get(issuer)

  if (entry) {
    const age = now - entry.fetchedAt
    if (age < CACHE_TTL_MS) return entry.keySet
    if (!entry.revalidating) {
      entry.revalidating = true
      fetchAndStore(issuer).catch((err) => {
        console.error('JWKS refresh failed:', err)
        const e = cache.get(issuer)
        if (e) e.revalidating = false
      })
    }
    return entry.keySet
  }

  return fetchAndStore(issuer)
}

async function fetchAndStore(issuer: string): Promise<JWTVerifyGetKey> {
  const url = `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const body = (await res.json()) as { keys: object[] }

  const keySet = createLocalJWKSet({ keys: body.keys } as Parameters<typeof createLocalJWKSet>[0])
  cache.set(issuer, { keySet, fetchedAt: Date.now(), revalidating: false })
  return keySet
}
