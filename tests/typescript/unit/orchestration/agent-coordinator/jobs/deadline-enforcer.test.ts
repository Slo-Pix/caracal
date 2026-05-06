// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Deadline enforcer unit tests covering invocation timeout sweeps.

import { describe, expect, it, vi } from 'vitest'
import { runDeadlineSweep } from '../../../../../../apps/agent-coordinator/src/jobs/deadline-enforcer.js'

function clientWith(rows: unknown[], acquired = true) {
  return {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ acquired }] })
      .mockResolvedValueOnce({ rows })
      .mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
}

describe('runDeadlineSweep', () => {
  it('skips when another node holds the lock', async () => {
    const client = clientWith([], false)
    const db = { connect: vi.fn().mockResolvedValueOnce(client) }
    await expect(runDeadlineSweep(db as never)).resolves.toBe(0)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('marks running invocations past deadline as timed_out and enqueues events', async () => {
    const rows = [
      { id: 'inv-1', zone_id: 'z1', service_id: 'svc-1' },
      { id: 'inv-2', zone_id: 'z1', service_id: 'svc-2' },
    ]
    const client = clientWith(rows)
    const db = { connect: vi.fn().mockResolvedValueOnce(client) }

    const count = await runDeadlineSweep(db as never)
    expect(count).toBe(2)

    const updateCall = client.query.mock.calls.find((call) => String(call[0]).includes("status = 'timed_out'"))
    expect(updateCall).toBeDefined()
    const outboxInserts = client.query.mock.calls.filter((call) => String(call[0]).includes('caracal_outbox'))
    expect(outboxInserts.length).toBe(2)
    const dedupeKeys = outboxInserts.map((call) => call[1]?.[2])
    expect(dedupeKeys).toEqual(expect.arrayContaining([
      'invocation.timed_out:inv-1', 'invocation.timed_out:inv-2',
    ]))
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })
})
