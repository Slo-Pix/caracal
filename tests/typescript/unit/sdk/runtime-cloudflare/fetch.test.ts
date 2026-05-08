// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Cloudflare token exchange tests for STS request and error handling.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { exchangeToken } from '../../../../../packages/runtime-adaptor/cloudflare/ts/src/fetch.js'

describe('exchangeToken', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts RFC 8693 token exchange form data to STS', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'resource-token', expires_in: 900 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await exchangeToken(
      'https://sts.example.com',
      'zone1:app1',
      'subject-token',
      'resource://api',
      ['read', 'write'],
    )

    const request = fetchMock.mock.calls[0][1]
    const body = request.body as URLSearchParams
    expect(fetchMock.mock.calls[0][0]).toBe('https://sts.example.com/oauth/2/token')
    expect(request.method).toBe('POST')
    expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:token-exchange')
    expect(body.get('subject_token')).toBe('subject-token')
    expect(body.get('resource')).toBe('resource://api')
    expect(body.get('client_id')).toBe('zone1:app1')
    expect(body.get('scope')).toBe('read write')
    expect(result).toEqual({ accessToken: 'resource-token', expiresIn: 900 })
  })

  it('uses STS error descriptions when exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error_description: 'scope denied' }),
    }))

    await expect(exchangeToken('https://sts.example.com', 'zone1:app1', 'subject-token', 'resource://api'))
      .rejects.toThrow('scope denied')
  })

  it('rejects malformed STS error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'not-json',
    }))

    await expect(exchangeToken('https://sts.example.com', 'zone1:app1', 'subject-token', 'resource://api'))
      .rejects.toThrow('STS error 502: invalid error response')
  })
})