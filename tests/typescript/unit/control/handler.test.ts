// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the control invoke route registration and pre-authentication request limiting.

import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthError, type Authenticator } from '../../../../apps/control/src/auth.js'
import { registerInvokeRoute, type InvokeDeps } from '../../../../apps/control/src/handler.js'
import { RateLimiter } from '../../../../apps/control/src/ratelimit.js'
import type { EventSink } from '../../../../apps/control/src/audit.js'
import type { Replay } from '../../../../apps/control/src/replay.js'
import type { DispatchContext } from '../../../../packages/engine/src/dispatch.js'

const apps: { close(): Promise<void> }[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function deps(verify: Authenticator['verify']): InvokeDeps {
  return {
    auth: { verify } as Authenticator,
    replay: { mark: vi.fn(), ping: vi.fn() } as unknown as Replay,
    rate: new RateLimiter(10, 60_000),
    routeRateLimit: { max: 1, timeWindow: 60_000 },
    sink: { emit: vi.fn(async () => {}) } as EventSink,
    ctx: { admin: {} } as DispatchContext,
    gate: { enabled: () => true },
  }
}

describe('registerInvokeRoute', () => {
  it('rate-limits invoke requests before authentication work runs', async () => {
    const app = Fastify()
    apps.push(app)
    const verify = vi.fn(async () => {
      throw new AuthError('invalid token')
    })

    await app.register(rateLimit, { global: false, max: 1, timeWindow: 60_000 })
    registerInvokeRoute(app, deps(verify))

    const first = await app.inject({
      method: 'POST',
      url: '/v1/control/invoke',
      headers: { authorization: 'Bearer bad' },
      payload: {},
    })
    const second = await app.inject({
      method: 'POST',
      url: '/v1/control/invoke',
      headers: { authorization: 'Bearer bad' },
      payload: {},
    })

    expect(first.statusCode).toBe(401)
    expect(second.statusCode).toBe(429)
    expect(verify).toHaveBeenCalledTimes(1)
  })

  it('blocks invoke requests when the runtime endpoint gate is closed', async () => {
    const app = Fastify()
    apps.push(app)
    const verify = vi.fn()
    const d = deps(verify)
    d.gate = { enabled: () => false }

    await app.register(rateLimit, { global: false, max: 1, timeWindow: 60_000 })
    registerInvokeRoute(app, d)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/control/invoke',
      headers: { authorization: 'Bearer token' },
      payload: {},
    })

    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ error: 'control disabled' })
    expect(verify).not.toHaveBeenCalled()
  })
})
