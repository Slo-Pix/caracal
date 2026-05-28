// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Provider route unit tests for zone ownership and configuration updates.

import { describe, it, expect } from 'vitest'
import { providersRoutes } from '../../../../../apps/api/src/routes/providers.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

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
        rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'oauth-main', kind: 'oauth2' }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/providers',
      payload: {
        identifier: 'oauth-main',
        kind: 'oauth2',
        config_json: {
          token_endpoint: 'https://issuer.example/oauth/token',
          allowed_token_hosts: ['issuer.example'],
        },
      },
    })

    const values = db.query.mock.calls[1][1] as unknown[]
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'oauth2' })
    expect(values[4]).toBe('oauth2')
    expect(JSON.parse(values[5] as string)).toEqual({
      token_endpoint: 'https://issuer.example/oauth/token',
      allowed_token_hosts: ['issuer.example'],
    })
  })

  it('rejects unsupported provider config fields', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/providers',
      payload: { identifier: 'oauth-main', kind: 'oauth2', config_json: { authorization_endpoint: 'https://issuer.example/auth' } },
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
      rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'apikey-main', kind: 'apikey' }],
    })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/providers/provider-1',
      payload: { kind: 'apikey', config_json: { header_name: 'X-Api-Key' } },
    })

    const values = db.query.mock.calls[0][1] as unknown[]
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'apikey' })
    expect(values.slice(0, 2)).toEqual(['provider-1', 'z1'])
    expect(values).toContain('apikey')
    expect(JSON.parse(values[3] as string)).toEqual({ header_name: 'X-Api-Key' })
  })

  it('validates config-only patches against the existing provider kind', async () => {
    const { app, db } = buildRouteApp(providersRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ kind: 'oauth2' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'provider-1', zone_id: 'z1', identifier: 'oauth-main', kind: 'oauth2' }],
      })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/providers/provider-1',
      payload: {
        config_json: {
          token_endpoint: 'https://issuer.example/oauth/token',
          allowed_token_hosts: ['issuer.example'],
        },
      },
    })

    const values = db.query.mock.calls[1][1] as unknown[]
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'provider-1', kind: 'oauth2' })
    expect(values.slice(0, 2)).toEqual(['provider-1', 'z1'])
    expect(JSON.parse(values[2] as string)).toEqual({
      token_endpoint: 'https://issuer.example/oauth/token',
      allowed_token_hosts: ['issuer.example'],
    })
  })
})
