// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Policy set route unit tests for activation contract checks and durable outbox enqueue.

import { describe, it, expect, vi } from 'vitest'
import { policySetsRoutes } from '../../../../../apps/api/src/routes/policy-sets.js'
import { buildRouteApp } from '../../../../shared/test-utils/typescript/fastify.js'

describe('POST /v1/zones/:zoneId/policy-sets/:id/activate', () => {
  it('rejects policies that do not emit result', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: [{ policy_version_id: 'pv-1' }], schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content: 'package caracal.authz\ndefault allow = false', zone_id: 'z1', schema_version: '2026-05-20' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/activate',
      payload: { version_id: 'psv-1' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid_policy_contract' })
  })

  it('rejects manifests that reference policies in another zone', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: [{ policy_version_id: 'pv-1' }], schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content: 'package caracal.authz\nresult := {}', zone_id: 'z2', schema_version: '2026-05-20' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/activate',
      payload: { version_id: 'psv-1' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).detail).toMatch(/different zone/)
  })

  it('activates valid version, enqueues outbox row in TX, returns 202', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    const manifest = [{ policy_version_id: 'pv-1' }]
    const content = 'package caracal.authz\nresult := {"allow": true}'
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: manifest, schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content, zone_id: 'z1', schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [] })

    const client = { query: vi.fn(), release: vi.fn() }
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
    db.connect.mockResolvedValueOnce(client)

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/activate',
      payload: { version_id: 'psv-1' },
    })

    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.body)).toMatchObject({ activated: true, version_id: 'psv-1' })
    expect(JSON.parse(res.body).outbox_id).toEqual(expect.any(String))
    expect(JSON.parse(res.body).status_url).toContain('/activation-status?version_id=psv-1&outbox_id=')
    const sqls = client.query.mock.calls.map((c) => String(c[0]))
    expect(sqls[0]).toBe('BEGIN')
    expect(sqls.at(-1)).toBe('COMMIT')
    expect(sqls.some((sql) => sql.includes('INSERT INTO event_outbox'))).toBe(true)
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})

describe('GET /v1/zones/:zoneId/policy-sets/:id/activation-status', () => {
  it('reports active binding, dispatched outbox, and loaded STS bundle', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    app.decorate('cfg', {
      stsUrl: 'http://sts.local',
      gatewayStsHmacKey: Buffer.alloc(32, 1),
    } as never)
    db.query
      .mockResolvedValueOnce({ rows: [{ active_version_id: 'psv-1', shadow_version_id: null, manifest_sha256: 'sha-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'outbox-1',
          stream_name: 'caracal.policy.invalidate',
          payload_json: { zone_id: 'z1', policy_set_id: 'ps-1', policy_set_version_id: 'psv-1' },
          attempts: 1,
          last_error: null,
          dispatched_at: new Date('2026-01-01T00:00:00Z'),
          available_at: new Date('2026-01-01T00:00:00Z'),
        }],
      })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      zone_id: 'z1',
      loaded: true,
      policy_set_version_id: 'psv-1',
      manifest_sha256: 'sha-1',
      loaded_at: '2026-01-01T00:00:01Z',
      age_seconds: 1,
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones/z1/policy-sets/ps-1/activation-status?version_id=psv-1&outbox_id=outbox-1',
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      active: true,
      propagation_status: 'loaded',
      outbox: { id: 'outbox-1', state: 'dispatched' },
      sts: { state: 'loaded', policy_set_version_id: 'psv-1' },
    })
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://sts.local/internal/policy/status/z1')
    fetchMock.mockRestore()
  })
})

describe('POST /v1/zones/:zoneId/policy-sets/:id/simulate', () => {
  it('validates rollout contract without mutating bindings', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    const manifest = [{ policy_version_id: 'pv-1' }]
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: manifest, manifest_sha256: 'sha-1', schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content: 'package caracal.authz\nresult := {"decision": "deny", "evaluation_status": "complete", "determining_policies": [], "diagnostics": []}', zone_id: 'z1', schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/simulate',
      payload: {
        version_id: 'psv-1',
        input: {
          schema_version: '2026-05-20',
          principal: { zone_id: 'z1' },
          resource: { identifier: 'resource://calendar' },
          action: { id: 'token_exchange' },
          context: {},
        },
      },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      dry_run: true,
      would_activate: true,
      version_id: 'psv-1',
      input_schema_version: '2026-05-20',
    })
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('executes supplied input through STS when internal simulation is configured', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    app.decorate('cfg', {
      stsUrl: 'http://sts.local',
      gatewayStsHmacKey: Buffer.alloc(32, 1),
    } as never)
    const manifest = [{ policy_version_id: 'pv-1' }]
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: manifest, manifest_sha256: 'sha-1', schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content: 'package caracal.authz\nresult := {"decision": "allow", "evaluation_status": "complete", "determining_policies": [], "diagnostics": []}', zone_id: 'z1', schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      policy_set_id: 'ps-1',
      version_id: 'psv-1',
      manifest_sha256: 'sha-1',
      result: {
        decision: 'allow',
        evaluation_status: 'complete',
        determining_policies: [],
        diagnostics: [],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/simulate',
      payload: {
        version_id: 'psv-1',
        input: {
          schema_version: '2026-05-20',
          principal: { zone_id: 'z1' },
          resource: { identifier: 'resource://calendar' },
          action: { id: 'token_exchange' },
          context: {},
        },
      },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      explanation: { evaluation: 'executed', decision: 'allow' },
      result: { decision: 'allow', evaluation_status: 'complete' },
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://sts.local/internal/policy/simulate')
    expect((init as RequestInit).headers).toMatchObject({
      'content-type': 'application/json',
      'X-Caracal-Gateway-Timestamp': expect.any(String),
      'X-Caracal-Gateway-Request': expect.any(String),
      'X-Caracal-Gateway-Signature': expect.any(String),
    })
    fetchMock.mockRestore()
  })

  it('rejects schema-mismatched policy versions', async () => {
    const { app, db } = buildRouteApp(policySetsRoutes)
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'psv-1', manifest_json: [{ policy_version_id: 'pv-1' }], manifest_sha256: 'sha-1', schema_version: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pv-1', content: 'package caracal.authz\nresult := {}', zone_id: 'z1', schema_version: '2026-03-16' }] })

    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/zones/z1/policy-sets/ps-1/simulate',
      payload: { version_id: 'psv-1' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).detail).toContain('does not match policy set schema')
  })
})
