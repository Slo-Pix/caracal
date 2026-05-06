// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// AdminClient unit tests covering request shape, query encoding, and error mapping.

import { describe, it, expect, vi } from 'vitest'
import { AdminClient } from '../../../../../packages/caracalai-admin/src/client.js'
import { AdminApiError } from '../../../../../packages/caracalai-admin/src/errors.js'

function fetchOk(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as typeof fetch
}

function fetchErr(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Bad Request',
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as typeof fetch
}

describe('AdminClient', () => {
  it('sends Bearer token and parses JSON', async () => {
    const f = fetchOk([{ id: 'z1', slug: 'demo' }])
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 't', fetchImpl: f })
    const out = await c.zones.list()
    expect(out).toEqual([{ id: 'z1', slug: 'demo' }])
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(url).toBe('http://api/v1/zones')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t')
  })

  it('encodes query parameters and skips empty values', async () => {
    const f = fetchOk([])
    const c = new AdminClient({ apiUrl: 'http://api/', adminToken: 't', fetchImpl: f })
    await c.audit.list('z1', { decision: 'deny', limit: 50, since: undefined })
    const [url] = (f as unknown as { mock: { calls: [string][] } }).mock.calls[0]
    expect(url).toBe('http://api/v1/zones/z1/audit?decision=deny&limit=50')
  })

  it('serializes JSON body with Content-Type', async () => {
    const f = fetchOk({ id: 'z2', slug: 'new' })
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 't', fetchImpl: f })
    await c.zones.create({ slug: 'new', display_name: 'New Zone' })
    const [, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ slug: 'new', display_name: 'New Zone' })
  })

  it('returns undefined for 204 / expectEmpty', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204, statusText: 'No Content', text: async () => '', json: async () => undefined }) as unknown as typeof fetch
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 't', fetchImpl: f })
    const out = await c.zones.delete('z1')
    expect(out).toBeUndefined()
  })

  it('throws AdminApiError with parsed body and code', async () => {
    const f = fetchErr(400, { error: 'invalid_input', detail: 'bad slug' })
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 't', fetchImpl: f })
    await expect(c.zones.create({ slug: '!!', display_name: 'x' })).rejects.toMatchObject({
      name: 'AdminApiError',
      status: 400,
      code: 'invalid_input',
    })
    try {
      await c.zones.create({ slug: '!!', display_name: 'x' })
    } catch (e) {
      expect(e).toBeInstanceOf(AdminApiError)
      expect((e as AdminApiError).body).toEqual({ error: 'invalid_input', detail: 'bad slug' })
    }
  })

  it('falls back to status text when response is not JSON', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'Server Error',
      text: async () => '<html>nope</html>', json: async () => { throw new Error('x') },
    }) as unknown as typeof fetch
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 't', fetchImpl: f })
    await expect(c.zones.list()).rejects.toMatchObject({ status: 500, code: 'Server Error' })
  })

  it('routes coordinator calls to the coordinator base with its token', async () => {
    const f = fetchOk([])
    const c = new AdminClient({
      apiUrl: 'http://api',
      coordinatorUrl: 'http://coord',
      adminToken: 'a',
      coordinatorToken: 'jwt',
      fetchImpl: f,
    })
    await c.agents.list('z1')
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(url).toBe('http://coord/zones/z1/agents')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt')
  })

  it('throws when coordinator URL is missing', async () => {
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 'a', fetchImpl: fetchOk([]) })
    await expect(c.agents.list('z1')).rejects.toThrow(/coordinator_url_not_configured/)
  })

  it('throws when coordinator token is missing', async () => {
    const c = new AdminClient({
      apiUrl: 'http://api',
      coordinatorUrl: 'http://coord',
      adminToken: 'a',
      fetchImpl: fetchOk([]),
    })
    await expect(c.agents.list('z1')).rejects.toThrow(/coordinator_token_not_configured/)
  })

  it('hits the audit by-request detail endpoint', async () => {
    const f = fetchOk([{ id: 'a1', event_type: 'token.exchange', request_id: 'req-9' }])
    const c = new AdminClient({ apiUrl: 'http://api', adminToken: 't', fetchImpl: f })
    const rows = await c.audit.byRequest('z1', 'req-9')
    expect(rows).toHaveLength(1)
    const [url] = (f as unknown as { mock: { calls: [string][] } }).mock.calls[0]
    expect(url).toBe('http://api/v1/zones/z1/audit/by-request/req-9')
  })

  it('PATCH revoke sends method and parses body', async () => {
    const f = fetchOk({ revoked_edges: 3, affected_sessions: 2 })
    const c = new AdminClient({
      apiUrl: 'http://api', coordinatorUrl: 'http://coord',
      adminToken: 'a', coordinatorToken: 'jwt', fetchImpl: f,
    })
    const out = await c.delegations.revoke('z1', 'edge-1')
    expect(out).toEqual({ revoked_edges: 3, affected_sessions: 2 })
    const [, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(init.method).toBe('PATCH')
  })
})
