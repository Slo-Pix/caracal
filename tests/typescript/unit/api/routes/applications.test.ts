// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Application route unit tests for dynamic client registration zone controls.

import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import type { DB } from '../../../../../apps/api/src/db.js'
import type { RedisClient } from '../../../../../apps/api/src/redis.js'
import '../../../../../apps/api/src/fastify-augmentation.js'
import { applicationsRoutes } from '../../../../../apps/api/src/routes/applications.js'

function buildApp() {
  const app = Fastify({ logger: false })
  const clientQuery = vi.fn()
  const db = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue({
      query: clientQuery,
      release: vi.fn(),
    }),
  }
  const redis = {
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn(),
    expire: vi.fn(),
  }
  app.decorate('db', db as unknown as DB)
  app.decorate('redis', redis as unknown as RedisClient)
  app.register(applicationsRoutes, { prefix: '/v1' })
  return { app, db, clientQuery, redis }
}

describe('POST /v1/zones/:zoneId/applications', () => {
  it('rejects confidential managed applications without a client secret', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications',
      payload: { name: 'Runner', registration_method: 'managed', credential_type: 'token' },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'client_secret_required' })
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported credential types', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications',
      payload: {
        name: 'Browser',
        registration_method: 'managed',
        credential_type: 'public',
        client_secret: 'secret',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid_application' })
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('rejects DCR registration through the managed application route', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications',
      payload: {
        name: 'Dynamic App',
        registration_method: 'dcr',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('rejects unused application consent configuration', async () => {
    const { app, db } = buildApp()
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications',
      payload: {
        name: 'Runner',
        registration_method: 'managed',
        credential_type: 'token',
        client_secret: 'secret',
        consent: true,
      },
    })

    expect(res.statusCode).toBe(400)
    expect(db.query).toHaveBeenCalledTimes(1)
  })
})

describe('POST /v1/zones/:zoneId/applications/dcr', () => {
  it('rejects confidential DCR applications without a client secret', async () => {
    const { app, db, redis } = buildApp()

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App', credential_type: 'token' },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'client_secret_required' })
    expect(redis.incr).not.toHaveBeenCalled()
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('rejects DCR when the zone has disabled it', async () => {
    const { app, clientQuery, redis } = buildApp()
    redis.incr.mockResolvedValueOnce(1)
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ dcr_enabled: false }] }) // zone select
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App', credential_type: 'token', client_secret: 'secret' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'dcr_disabled' })
  })

  it('creates a DCR application when the zone enables it', async () => {
    const { app, clientQuery, redis } = buildApp()
    redis.incr.mockResolvedValueOnce(1)
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ dcr_enabled: true }] })
      .mockResolvedValueOnce({ rows: [{ n: '0' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'app-1', zone_id: 'z1', registration_method: 'dcr' }] })
      .mockResolvedValueOnce({ rows: [] }) // COMMIT

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App', credential_type: 'token', client_secret: 'secret' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'app-1', registration_method: 'dcr' })
  })

  it('returns 429 when the DCR rate limit is exceeded', async () => {
    const { app, db, redis } = buildApp()
    redis.incr.mockResolvedValueOnce(11)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App', credential_type: 'token', client_secret: 'secret' },
    })

    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'dcr_rate_limit_exceeded' })
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('returns 429 when the active DCR application cap is reached', async () => {
    const { app, clientQuery, redis } = buildApp()
    redis.incr.mockResolvedValueOnce(1)
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ dcr_enabled: true }] })
      .mockResolvedValueOnce({ rows: [{ n: '1000' }] })
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/applications/dcr',
      payload: { name: 'Dynamic App', credential_type: 'token', client_secret: 'secret' },
    })

    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'dcr_limit_exceeded' })
  })
})
