// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// IsolateSafeTokenCache: per-isolate token map keyed by subject+resource.

export interface CachedToken {
  accessToken: string
  expiresAt: number
}

export class IsolateSafeTokenCache {
  private readonly map = new Map<string, CachedToken>()

  get(subject: string, resource: string): string | undefined {
    const key = `${subject}::${resource}`
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() / 1000 >= entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    return entry.accessToken
  }

  set(subject: string, resource: string, accessToken: string, expiresIn: number): void {
    this.map.set(`${subject}::${resource}`, {
      accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    })
  }
}
