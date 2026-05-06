// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Team route unit tests for member serialization and zone-scoped updates.

import { describe, it, expect } from 'vitest'
import { teamsRoutes } from '../../../../../apps/api/src/routes/teams.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

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
  it('returns 404 when team is not in the zone', async () => {
    const { app, db } = buildRouteApp(teamsRoutes)
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    await app.ready()
    const res = await app.inject({ method: 'DELETE', url: '/v1/zones/z1/teams/team-other-zone' })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'team_not_found' })
  })
})