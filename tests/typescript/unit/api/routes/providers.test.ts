// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Provider route unit tests for zone ownership and configuration updates.

import { describe, it, expect } from 'vitest'
import { providersRoutes } from '../../../../../apps/api/src/routes/providers.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

process.env.ZONE_KEK = '1111111111111111111111111111111111111111111111111111111111111111'

describe('GET /v1/zones/:zoneId/providers/:id', () => {
  it('returns 404 when provider is outside the zone', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/providers/provider-other-zone' })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'provider_not_found' })
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 AND zone_id = $2'), [
      'provider-other-zone',
      'z1',
    ])
  })
})

describe('POST /v1/zones/:zoneId/providers', () => {
  it('stores provider kind and validated config in provider_kind', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'oauth-main', kind: 'oauth2_client_credentials' }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/providers',
      payload: {
        identifier: 'oauth-main',
        kind: 'oauth2_client_credentials',
        config_json: {
          token_endpoint: 'https://issuer.example/oauth/token',
          client_id: 'hooli-client',
          client_secret: 'hooli-secret',
          allowed_token_hosts: ['issuer.example'],
        },
      },
    })

    const values = db.query.mock.calls[1][1] as unknown[]
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'oauth2_client_credentials' })
    expect(values[4]).toBe('oauth2_client_credentials')
    expect(JSON.parse(values[5] as string)).toEqual({
      token_endpoint: 'https://issuer.example/oauth/token',
      client_id: 'hooli-client',
      client_auth_method: 'client_secret_basic',
      allowed_token_hosts: ['issuer.example'],
    })
    expect(values[8]).toEqual(['client_secret'])
  })

  it('creates Caracal mandate providers without secret config', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'caracal-mandate', kind: 'caracal_mandate' }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/providers',
      payload: {
        identifier: 'caracal-mandate',
        kind: 'caracal_mandate',
      },
    })

    const values = db.query.mock.calls[1][1] as unknown[]
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'caracal_mandate' })
    expect(values[4]).toBe('caracal_mandate')
    expect(JSON.parse(values[5] as string)).toEqual({})
    expect(values[6]).toBeNull()
    expect(values[7]).toBeNull()
    expect(values[8]).toEqual([])
  })

  it('generates provider identifiers from provider names when omitted', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'provider://hooli-oauth2', kind: 'caracal_mandate' }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/providers',
      payload: {
        identifier: '',
        name: 'Hooli OAuth2',
        kind: 'caracal_mandate',
        config_json: {},
      },
    })

    const values = db.query.mock.calls[1][1] as unknown[]
    expect(res.statusCode).toBe(201)
    expect(values[2]).toBe('Hooli OAuth2')
    expect(values[3]).toBe('provider://hooli-oauth2')
  })

  it('rejects unsupported provider config fields', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/providers',
      payload: { identifier: 'oauth-main', kind: 'oauth2_client_credentials', config_json: { authorization_endpoint: 'https://issuer.example/auth' } },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid_provider_config' })
  })
})

describe('PATCH /v1/zones/:zoneId/providers/:id', () => {
  it('rejects an empty update body', async () => {
    const { app, db } = buildRouteApp(providersRoutes)

    await app.ready()
    const res = await app.inject({ method: 'PATCH', url: '/v1/zones/z1/providers/provider-1', payload: {} })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'no_fields' })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('replaces provider config with validated provider settings', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'apikey-main', kind: 'api_key' }],
    })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/providers/provider-1',
      payload: { kind: 'api_key', config_json: { header_name: 'X-Api-Key', api_key: 'hooli-api-key' } },
    })

    const values = db.query.mock.calls[0][1] as unknown[]
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'api_key' })
    expect(values.slice(0, 2)).toEqual(['provider-1', 'z1'])
    expect(values).toContain('api_key')
    expect(JSON.parse(values[3] as string)).toEqual({ header_name: 'X-Api-Key' })
  })

  it('validates config-only patches against the existing provider kind', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ kind: 'oauth2_client_credentials' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'oauth-main', kind: 'oauth2_client_credentials' }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/providers/provider-1',
      payload: {
        config_json: {
          token_endpoint: 'https://issuer.example/oauth/token',
          client_id: 'hooli-client',
          allowed_token_hosts: ['issuer.example'],
        },
      },
    })

    const values = db.query.mock.calls[1][1] as unknown[]
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'oauth2_client_credentials' })
    expect(values.slice(0, 2)).toEqual(['provider-1', 'z1'])
    expect(JSON.parse(values[2] as string)).toEqual({
      token_endpoint: 'https://issuer.example/oauth/token',
      client_id: 'hooli-client',
      client_auth_method: 'client_secret_basic',
      allowed_token_hosts: ['issuer.example'],
    })
  })
})
