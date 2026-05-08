// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TokenCache interface and in-memory default keyed by subject+resource.

import type { TokenExchangeResponse } from './types.js'

export interface TokenCache {
  get(subjectToken: string, resource: string): TokenExchangeResponse | undefined
  set(subjectToken: string, resource: string, token: TokenExchangeResponse): void
}

export class InMemoryTokenCache implements TokenCache {
  private readonly map = new Map<string, { token: TokenExchangeResponse; expiresAt: number }>()

  get(subjectToken: string, resource: string): TokenExchangeResponse | undefined {
    const key = `${subjectToken}::${resource}`
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() / 1000 >= entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    return entry.token
  }

  set(subjectToken: string, resource: string, token: TokenExchangeResponse): void {
    this.map.set(`${subjectToken}::${resource}`, {
      token,
      expiresAt: token.issuedAt + token.expiresIn,
    })
  }
}
