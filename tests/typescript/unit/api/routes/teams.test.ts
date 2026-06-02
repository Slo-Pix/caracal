// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Team route unit tests for member serialization and zone-scoped updates.

import { describe, it, expect } from 'vitest'
import { teamsRoutes } from '../../../../../apps/api/src/routes/teams.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

describe('GET /v1/zones/:zoneId/teams', () => {
  it('lists teams with keyset pagination', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'team-2', zone_id: 'z1', name: 'Operators', created_at: '2026-01-02T00:00:00.000Z' },
        { id: 'team-1', zone_id: 'z1', name: 'Observers', created_at: '2026-01-01T00:00:00.000Z' },
      ],
    })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/teams?limit=1' })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toHaveLength(2)
    expect(res.headers.link).toContain('cursor=')
    expect(db.query.mock.calls[0][1]).toEqual(['z1', 1])
  })
})

describe('GET /v1/zones/:zoneId/teams/:id', () => {
  it('returns a zone-scoped team or 404', async () => {
    const found = buildRouteApp(teamsRoutes)
    found.db.query.mockResolvedValueOnce({
      rows: [{ id: 'team-1', zone_id: 'z1', name: 'Operators', members_json: [] }],
    })
    await found.app.ready()
    const res = await found.app.inject({ method: 'GET', url: '/v1/zones/z1/teams/team-1' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'team-1', name: 'Operators' })

    const missing = buildRouteApp(teamsRoutes)
    missing.db.query.mockResolvedValueOnce({ rows: [] })
    await missing.app.ready()
    const missingRes = await missing.app.inject({ method: 'GET', url: '/v1/zones/z1/teams/team-1' })
    expect(missingRes.statusCode).toBe(404)
    expect(JSON.parse(missingRes.body)).toMatchObject({ error: 'team_not_found' })
  })
})

describe('POST /v1/zones/:zoneId/teams', () => {
  it('creates a team with serialized members', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({ rows: [{ id: 'team-1', zone_id: 'z1', name: 'Operators' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/teams',
      payload: { name: 'Operators', members: [{ id: 'user-1', role: 'admin' }] },
    })

    const values = db.query.mock.calls[0][1] as unknown[]
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'team-1', name: 'Operators' })
    expect(JSON.parse(values[3] as string)).toEqual([{ id: 'user-1', role: 'admin' }])
  })
})

describe('PATCH /v1/zones/:zoneId/teams/:id', () => {
  it('updates team members with serialized JSON', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({ rows: [{ id: 'team-1', zone_id: 'z1', name: 'Operators' }] })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/teams/team-1',
      payload: { members: [{ id: 'user-2', role: 'viewer' }] },
    })

    const values = db.query.mock.calls[0][1] as unknown[]
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'team-1' })
    expect(values).toEqual(['team-1', 'z1', JSON.stringify([{ id: 'user-2', role: 'viewer' }])])
  })

  it('rejects empty team updates before storage', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)

    await app.ready()
    const res = await app.inject({ method: 'PATCH', url: '/v1/zones/z1/teams/team-1', payload: {} })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'no_fields' })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns 404 for cross-zone team updates', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/zones/z1/teams/team-other-zone',
      payload: { name: 'Operators' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'team_not_found' })
  })
})

describe('DELETE /v1/zones/:zoneId/teams/:id', () => {
  it('deletes a zone-scoped team', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] })

    await app.ready()
    const res = await app.inject({ method: 'DELETE', url: '/v1/zones/z1/teams/team-1' })

    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })

  it('returns 404 when team is not in the zone', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    await app.ready()
    const res = await app.inject({ method: 'DELETE', url: '/v1/zones/z1/teams/team-other-zone' })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'team_not_found' })
  })
})
