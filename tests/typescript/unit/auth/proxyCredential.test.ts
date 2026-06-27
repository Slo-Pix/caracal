// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Console BFF proxy credential selection: reads use the read token, writes use the write token, the admin token is the break-glass fallback.

import { describe, expect, it } from 'vitest'
import { selectProxyCredential, shouldRetryWithFallback } from '../../../../apps/auth/src/proxyCredential.ts'

const ADMIN = 'cat_admin_god'
const READ = 'cat_read_only'
const WRITE = 'cat_write'

describe('selectProxyCredential', () => {
  it('uses the read token with an admin fallback for GET', () => {
    expect(selectProxyCredential('GET', ADMIN, READ, WRITE)).toEqual({ token: READ, fallbackToken: ADMIN })
  })

  it('uses the read token with an admin fallback for HEAD', () => {
    expect(selectProxyCredential('HEAD', ADMIN, READ, WRITE)).toEqual({ token: READ, fallbackToken: ADMIN })
  })

  it('treats the method case-insensitively', () => {
    expect(selectProxyCredential('get', ADMIN, READ, WRITE)).toEqual({ token: READ, fallbackToken: ADMIN })
  })

  it('uses the write token with an admin fallback for writes', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(selectProxyCredential(method, ADMIN, READ, WRITE), method).toEqual({ token: WRITE, fallbackToken: ADMIN })
    }
  })

  it('never presents the read token on a write', () => {
    const credential = selectProxyCredential('POST', ADMIN, READ, WRITE)
    expect(credential.token).toBe(WRITE)
    expect(credential.token).not.toBe(READ)
  })

  it('keeps the admin token off the normal path: neither read nor write uses it as the primary', () => {
    expect(selectProxyCredential('GET', ADMIN, READ, WRITE).token).not.toBe(ADMIN)
    expect(selectProxyCredential('POST', ADMIN, READ, WRITE).token).not.toBe(ADMIN)
  })

  it('falls back to the admin token on a read when no read token is configured', () => {
    expect(selectProxyCredential('GET', ADMIN, undefined, WRITE)).toEqual({ token: ADMIN })
  })

  it('falls back to the admin token on a write when no write token is configured', () => {
    expect(selectProxyCredential('POST', ADMIN, READ, undefined)).toEqual({ token: ADMIN })
  })

  it('does not set a redundant fallback when a derived token equals the admin token', () => {
    expect(selectProxyCredential('GET', ADMIN, ADMIN, WRITE)).toEqual({ token: ADMIN })
    expect(selectProxyCredential('POST', ADMIN, READ, ADMIN)).toEqual({ token: ADMIN })
  })
})

describe('shouldRetryWithFallback', () => {
  it('retries on 401 when a distinct fallback exists', () => {
    expect(shouldRetryWithFallback(401, READ, ADMIN)).toBe(true)
  })

  it('does not retry on 403, a genuine authorization denial', () => {
    expect(shouldRetryWithFallback(403, READ, ADMIN)).toBe(false)
  })

  it('does not retry on a success or any non-401 status', () => {
    for (const status of [200, 204, 400, 404, 429, 500, 502]) {
      expect(shouldRetryWithFallback(status, READ, ADMIN), String(status)).toBe(false)
    }
  })

  it('does not retry when there is no fallback', () => {
    expect(shouldRetryWithFallback(401, ADMIN, undefined)).toBe(false)
  })

  it('does not retry when the fallback equals the token already used', () => {
    expect(shouldRetryWithFallback(401, ADMIN, ADMIN)).toBe(false)
  })
})
