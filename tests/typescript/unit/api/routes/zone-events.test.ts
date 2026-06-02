// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Zone event route tests cover audit and session read models.

import { describe, it, expect } from 'vitest'
import { zoneEventsRoutes } from '../../../../../apps/api/src/routes/zone-events.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

function cursor(ts: string, id: string): string {
  return Buffer.from(JSON.stringify({ ts, id }), 'utf8').toString('base64url')
}

describe('GET /v1/zones/:zoneId/audit', () => {
  it('returns zone-scoped audit events with redaction and cursor', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 'audit-1',
        zone_id: 'z1',
        decision: 'deny',
        occurred_at: '2026-05-01T00:00:00.000Z',
        metadata_json: { user: 'a', token: 'leak-me' },
      }],
    })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/audit' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.rows[0].metadata_json.token).toBe('[redacted]')
    expect(body.rows[0].metadata_json.user).toBe('a')
    expect(body.next_cursor).toBeNull()
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('zone_id = $1'), ['z1', 100])
  })

  it('applies filter parameters', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones/z1/audit?decision=deny&request_id=req-9&limit=50',
    })

    expect(res.statusCode).toBe(200)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('decision = $'),
      ['z1', 'req-9', 'deny', 50],
    )
  })

  it('applies all audit filters and emits a next cursor when the page is full', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'a2', occurred_at: '2026-05-02T00:00:00.000Z', metadata_json: {} },
        { id: 'a1', occurred_at: '2026-05-01T00:00:00.000Z', metadata_json: {} },
      ],
    })

    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: `/v1/zones/z1/audit?since=2026-05-01T00:00:00.000Z&until=2026-05-03T00:00:00.000Z&request_id=req-9&decision=allow&event_type=token_exchange&cursor=${cursor('2026-05-04T00:00:00.000Z', 'a3')}&limit=2`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.next_cursor).toEqual(expect.any(String))
    expect(db.query.mock.calls[0][1]).toEqual([
      'z1',
      '2026-05-01T00:00:00.000Z',
      '2026-05-03T00:00:00.000Z',
      'req-9',
      'allow',
      'token_exchange',
      '2026-05-04T00:00:00.000Z',
      'a3',
      2,
    ])
  })

  it('rejects malformed cursor values', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/audit?cursor=not-json' })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'invalid_cursor' })
    expect(db.query).not.toHaveBeenCalled()
  })
})

describe('GET /v1/zones/:zoneId/audit/by-request/:requestId', () => {
  it('returns full audit detail with diagnostics', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'a1', request_id: 'r1', decision: 'deny', determining_policies_json: [], diagnostics_json: [{ reason: 'no_active_policy_set' }], metadata_json: {} }],
    })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/audit/by-request/r1' })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)[0].diagnostics_json[0].reason).toBe('no_active_policy_set')
  })

  it('404s when no rows', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({ rows: [] })
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/audit/by-request/missing' })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /v1/zones/:zoneId/audit/by-request/:requestId/explain', () => {
  it('returns a why-denied summary with redacted metadata', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 'a1',
        event_type: 'token_exchange',
        request_id: 'r1',
        decision: 'deny',
        evaluation_status: 'complete',
        determining_policies_json: [{ policy: 'baseline-scopes' }],
        diagnostics_json: [{ reason: 'missing_scope' }],
        metadata_json: { token: 'secret', requested_scopes: ['write'] },
      }],
    })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/audit/by-request/r1/explain' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.final_decision).toBe('deny')
    expect(body.denied[0].diagnostics[0].reason).toBe('missing_scope')
    expect(body.denied[0].metadata.token).toBe('[redacted]')
  })

  it('returns 404 for missing explanations and reports allow when no deny events exist', async () => {
    const missing = buildRouteApp(zoneEventsRoutes)
    missing.db.query.mockResolvedValueOnce({ rows: [] })
    await missing.app.ready()
    const missingRes = await missing.app.inject({ method: 'GET', url: '/v1/zones/z1/audit/by-request/missing/explain' })
    expect(missingRes.statusCode).toBe(404)

    const allowed = buildRouteApp(zoneEventsRoutes)
    allowed.db.query.mockResolvedValueOnce({
      rows: [{ id: 'a1', event_type: 'token_exchange', decision: 'allow', evaluation_status: 'complete', metadata_json: {} }],
    })
    await allowed.app.ready()
    const allowedRes = await allowed.app.inject({ method: 'GET', url: '/v1/zones/z1/audit/by-request/r1/explain' })
    expect(allowedRes.statusCode).toBe(200)
    expect(JSON.parse(allowedRes.body)).toMatchObject({ final_decision: 'allow', denied: [] })
  })
})

describe('GET /v1/zones/:zoneId/sessions', () => {
  it('returns zone-scoped sessions', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'session-1', zone_id: 'z1', status: 'active', created_at: '2026-05-01T00:00:00.000Z' }],
    })

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/sessions' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.rows[0].id).toBe('session-1')
    expect(body.next_cursor).toBeNull()
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('zone_id = $1'), ['z1', 100])
  })

  it('applies session filters and emits a next cursor when the page is full', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'session-2', zone_id: 'z1', status: 'active', subject_id: 'user-1', created_at: '2026-05-02T00:00:00.000Z' },
        { id: 'session-1', zone_id: 'z1', status: 'active', subject_id: 'user-1', created_at: '2026-05-01T00:00:00.000Z' },
      ],
    })

    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: `/v1/zones/z1/sessions?status=active&subject_id=user-1&cursor=${cursor('2026-05-03T00:00:00.000Z', 'session-3')}&limit=2`,
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).next_cursor).toEqual(expect.any(String))
    expect(db.query.mock.calls[0][1]).toEqual([
      'z1',
      'active',
      'user-1',
      '2026-05-03T00:00:00.000Z',
      'session-3',
      2,
    ])
  })

  it('rejects malformed cursor values', async () => {
    const { app, db } = buildRouteApp(zoneEventsRoutes)

    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/zones/z1/sessions?cursor=not-json' })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'invalid_cursor' })
    expect(db.query).not.toHaveBeenCalled()
  })
})
