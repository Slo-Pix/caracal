// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Step-up challenge route unit tests for lookup and satisfaction guards.

import { describe, it, expect } from 'vitest'
import { stepUpChallengesRoutes } from '../../../../../apps/api/src/routes/step-up-challenges.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

describe('GET /v1/zones/:zoneId/step-up-challenges/:id', () => {
  it('returns 404 when challenge is missing or outside the zone', async () => {
    const { app, db } = buildRouteApp(stepUpChallengesRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/step-up-challenges/challenge-1' })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'challenge_not_found' })
  })
})

describe('POST /v1/zones/:zoneId/step-up-challenges/:id/satisfy', () => {
  it('rejects request without approver_subject_id', async () => {
    const { app } = buildRouteApp(stepUpChallengesRoutes)
    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/v1/zones/z1/step-up-challenges/challenge-1/satisfy' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid_request' })
  })

  it('returns 409 when challenge is expired, completed, cross-zone, or approver matches requester', async () => {
    const { app, db } = buildRouteApp(stepUpChallengesRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/step-up-challenges/challenge-1/satisfy',
      payload: { approver_subject_id: 'approver-a' },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'challenge_not_satisfiable' })
  })

  it('satisfies an active unsatisfied challenge with a distinct approver', async () => {
    const { app, db } = buildRouteApp(stepUpChallengesRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'challenge-1', satisfied_at: '2026-05-05T00:00:00.000Z', approver_subject_id: 'approver-a' }],
    })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/step-up-challenges/challenge-1/satisfy',
      payload: { approver_subject_id: 'approver-a' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'challenge-1', approver_subject_id: 'approver-a' })
  })
})