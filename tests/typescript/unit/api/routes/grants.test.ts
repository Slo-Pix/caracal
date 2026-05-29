// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Delegated grant route unit tests for same-zone references and scope boundaries.

import { afterEach, describe, it, expect, vi } from 'vitest'
import { loadZoneKek, seal } from '@caracalai/core'
import { grantsRoutes } from '../../../../../apps/api/src/routes/grants.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

process.env.ZONE_KEK = '1111111111111111111111111111111111111111111111111111111111111111'

const grantBody = {
  application_id: 'app-1',
  user_id: 'user-1',
  resource_id: 'res-1',
  scopes: ['read'],
}

function sealedSecretConfig(config: Record<string, string>): { ciphertext: Buffer; nonce: Buffer } {
  return seal(loadZoneKek(), Buffer.from(JSON.stringify(config), 'utf8'))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /v1/zones/:zoneId/grants', () => {
  it('rejects application references outside the zone', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: false, resource_scopes: ['read'] }] })

    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/grants', payload: grantBody })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'application_not_found' })
  })

  it('rejects resource references outside the zone', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, resource_scopes: null }] })

    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/grants', payload: grantBody })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'resource_not_found' })
  })

  it('rejects grant scopes outside the resource scope set', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, resource_scopes: ['read'] }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/grants',
      payload: { ...grantBody, scopes: ['write'] },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'grant_scopes_exceed_resource' })
  })

  it('creates a grant with same-zone references and bounded scopes', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ application_exists: true, resource_scopes: ['read', 'write'] }] })
      .mockResolvedValueOnce({ rows: [{ id: 'grant-1', zone_id: 'z1', scopes: ['read'] }] })

    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/grants', payload: grantBody })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'grant-1', scopes: ['read'] })
  })
})

describe('POST /v1/zones/:zoneId/provider-grants', () => {
  it('stores delegated provider tokens only for matching authorization-code resources', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          provider_kind: 'oauth2_authorization_code',
          resource_scopes: ['read', 'write'],
          resource_provider_id: 'provider-1',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-grant-1', zone_id: 'z1', provider_id: 'provider-1', scopes: ['read'] }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/provider-grants',
      payload: {
        user_id: 'user-1',
        resource_id: 'res-1',
        provider_id: 'provider-1',
        scopes: ['read'],
        access_token: 'provider-access',
        refresh_token: 'provider-refresh',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-grant-1', provider_id: 'provider-1' })
    const values = db.query.mock.calls[2][1] as unknown[]
    expect(values[6]).toBeInstanceOf(Buffer)
    expect(values[7]).toBeInstanceOf(Buffer)
  })
})

describe('OAuth provider grant browser flow', () => {
  it('creates a provider authorization URL with state and PKCE', async () => {
    const { app, db, redis } = buildRouteApp(grantsRoutes)
    redis.set.mockResolvedValue('OK')
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'provider-1',
          provider_kind: 'oauth2_authorization_code',
          config_json: {
            authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
            token_endpoint: 'https://oauth2.googleapis.com/token',
            redirect_uri: 'http://localhost:3000/v1/zones/z1/provider-grants/oauth/callback',
            client_id: 'google-client',
            client_auth_method: 'client_secret_basic',
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
            allowed_token_hosts: ['oauth2.googleapis.com'],
            authorization_params: { access_type: 'offline', prompt: 'consent' },
          },
          secret_config_ct: null,
          secret_config_nonce: null,
          resource_scopes: ['read', 'write'],
          resource_provider_id: 'provider-1',
        }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/provider-grants/oauth/authorize',
      payload: {
        user_id: 'user-1',
        resource_id: 'res-1',
        provider_id: 'provider-1',
        scopes: ['read'],
      },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { authorization_url: string; state: string }
    const url = new URL(body.authorization_url)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('google-client')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.readonly')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe(body.state)
    expect(redis.set).toHaveBeenCalledWith(`api:provider_oauth_state:${body.state}`, expect.any(String), 'EX', 600)
  })

  it('exchanges callback authorization codes and stores provider grants', async () => {
    const { app, db, redis } = buildRouteApp(grantsRoutes)
    const state = 'abcdefghijklmnopqrstuvwxyz1234567890'
    const sealed = sealedSecretConfig({ client_secret: 'google-secret' })
    redis.call.mockResolvedValue(JSON.stringify({
      zone_id: 'z1',
      user_id: 'user-1',
      resource_id: 'res-1',
      provider_id: 'provider-1',
      scopes: ['read'],
      code_verifier: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~',
    }))
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'provider-1',
          provider_kind: 'oauth2_authorization_code',
          config_json: {
            token_endpoint: 'https://oauth2.googleapis.com/token',
            redirect_uri: 'http://localhost:3000/v1/zones/z1/provider-grants/oauth/callback',
            client_id: 'google-client',
            client_auth_method: 'client_secret_basic',
            allowed_token_hosts: ['oauth2.googleapis.com'],
          },
          secret_config_ct: sealed.ciphertext,
          secret_config_nonce: sealed.nonce,
          resource_scopes: ['read', 'write'],
          resource_provider_id: 'provider-1',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-grant-1', zone_id: 'z1', provider_id: 'provider-1', scopes: ['read'] }],
      })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams
      expect(init?.method).toBe('POST')
      expect(init?.redirect).toBe('manual')
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('google-client:google-secret').toString('base64')}`)
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('code')).toBe('provider-code')
      expect(body.get('code_verifier')).toBe('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~')
      return new Response(JSON.stringify({ access_token: 'google-access', refresh_token: 'google-refresh', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: `/v1/zones/z1/provider-grants/oauth/callback?state=${state}&code=provider-code`,
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-grant-1', provider_id: 'provider-1' })
    expect(redis.call).toHaveBeenCalledWith('GETDEL', `api:provider_oauth_state:${state}`)
    const values = db.query.mock.calls[1][1] as unknown[]
    expect(values[6]).toBeInstanceOf(Buffer)
    expect(values[7]).toBeInstanceOf(Buffer)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects callback token exchanges outside the provider host allow-list', async () => {
    const { app, db, redis } = buildRouteApp(grantsRoutes)
    const state = 'abcdefghijklmnopqrstuvwxyz1234567890'
    redis.call.mockResolvedValue(JSON.stringify({
      zone_id: 'z1',
      user_id: 'user-1',
      resource_id: 'res-1',
      provider_id: 'provider-1',
      scopes: ['read'],
      code_verifier: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~',
    }))
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 'provider-1',
        provider_kind: 'oauth2_authorization_code',
        config_json: {
          token_endpoint: 'https://oauth2.googleapis.com/token',
          redirect_uri: 'http://localhost:3000/v1/zones/z1/provider-grants/oauth/callback',
          client_id: 'google-client',
          client_auth_method: 'none',
          allowed_token_hosts: ['login.example.com'],
        },
        secret_config_ct: null,
        secret_config_nonce: null,
        resource_scopes: ['read'],
        resource_provider_id: 'provider-1',
      }],
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: `/v1/zones/z1/provider-grants/oauth/callback?state=${state}&code=provider-code`,
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'provider_token_endpoint_not_allowed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('DELETE /v1/zones/:zoneId/grants/:id bounded session revocation', () => {
  it('pages session revocation in batches of 1000 and stops at the short batch', async () => {
    const { app, db } = buildRouteApp(grantsRoutes)

    const fullBatch = Array.from({ length: 1000 }, (_, i) => ({ id: `s${i}` }))
    const tailBatch = [{ id: 's-tail' }]

    const client = {
      query: vi.fn(),
      release: vi.fn(),
    }
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: fullBatch })

    for (let i = 0; i < fullBatch.length; i += 1) {
      client.query.mockResolvedValueOnce({ rows: [] })
    }

    client.query.mockResolvedValueOnce({ rows: tailBatch })
    client.query.mockResolvedValueOnce({ rows: [] })
    client.query.mockResolvedValueOnce({ rows: [] })

    db.connect.mockResolvedValue(client)

    await app.ready()
    const res = await app.inject({ method: 'DELETE', url: '/v1/zones/z1/grants/g1' })

    expect(res.statusCode).toBe(204)
    const updates = client.query.mock.calls.filter((c: unknown[]) => /UPDATE sessions SET status = 'revoked'/.test(c[0] as string))
    expect(updates.length).toBe(2)
    const limitArg = (updates[0][1] as unknown[])[2]
    expect(limitArg).toBe(1000)
  })
})
