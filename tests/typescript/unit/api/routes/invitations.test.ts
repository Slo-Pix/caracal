// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Invitation route unit tests for validation and cancellation boundaries.

import { describe, it, expect } from 'vitest'
import { invitationsRoutes } from '../../../../../apps/api/src/routes/invitations.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

describe('POST /v1/zones/:zoneId/invitations', () => {
  it('rejects malformed invitation emails before storage', async () => {
    const { app, db } = buildRouteApp(invitationsRoutes)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/invitations',
      payload: { email: 'not-an-email', role: 'admin', invited_by: 'user-1' },
    })

    expect(res.statusCode).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('creates invitation with explicit expiry', async () => {
    const { app, db } = buildRouteApp(invitationsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'invite-1', zone_id: 'z1', email: 'ops@example.com', role: 'admin' }],
    })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/invitations',
      payload: {
        email: 'ops@example.com',
        role: 'admin',
        invited_by: 'user-1',
        expires_at: '2027-01-01T00:00:00.000Z',
      },
    })

    const values = db.query.mock.calls[0][1] as unknown[]
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'invite-1', email: 'ops@example.com' })
    expect(values.slice(1)).toEqual(['z1', 'ops@example.com', 'admin', 'user-1', '2027-01-01T00:00:00.000Z'])
  })
})

describe('DELETE /v1/zones/:zoneId/invitations/:id', () => {
  it('does not cancel accepted or cross-zone invitations', async () => {
    const { app, db } = buildRouteApp(invitationsRoutes)
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    await app.ready()
    const res = await app.inject({ method: 'DELETE', url: '/v1/zones/z1/invitations/invite-1' })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invitation_not_found' })
  })
})