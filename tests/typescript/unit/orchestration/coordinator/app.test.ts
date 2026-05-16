// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Coordinator application factory tests for operational endpoint behavior.

import { describe, expect, it, vi } from 'vitest'
import '../../../../shared/test-utils/typescript/coordinatorEnv.js'

vi.mock('../../../../../apps/coordinator/src/auth.js', () => ({
  verifyBearer: async () => {},
}))

const { buildApp } = await import('../../../../../apps/coordinator/src/app.js')

describe('buildApp operational endpoints', () => {
  it('reuses runtime aggregate stats across metrics and stats requests', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ status: 'running', n: '2' }] })
        .mockResolvedValueOnce({ rows: [{ status: 'published', n: '3' }] }),
    }
    const app = await buildApp({
      cfg: {
        requestTimeoutMs: 1000,
        trustProxy: false,
        coordinatorRateLimitPerMin: 0,
      },
      db,
      redis: {},
    } as never)

    await app.ready()
    const metrics = await app.inject({ method: 'GET', url: '/metrics' })
    const stats = await app.inject({ method: 'GET', url: '/stats' })

    expect(metrics.statusCode).toBe(200)
    expect(metrics.body).toContain('caracal_invocations_total{status="running"} 2')
    expect(stats.statusCode).toBe(200)
    expect(stats.json()).toMatchObject({
      invocations: { running: 2 },
      outbox: { published: 3 },
    })
    expect(db.query).toHaveBeenCalledTimes(2)
    await app.close()
  })
})
