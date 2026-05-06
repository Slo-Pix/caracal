// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Deadline enforcer: marks running invocations past their deadline as timed_out.

import type { Pool } from 'pg'
import { cfg } from '../config.js'
import { enqueue, Topics } from '../outbox.js'

const SWEEP_LOCK = 'coordinator:invocation_deadline'

interface TimedOutInvocation {
  id: string
  zone_id: string
  service_id: string
}

export async function runDeadlineSweep(db: Pool): Promise<number> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows: lock } = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
      [SWEEP_LOCK],
    )
    if (!lock[0]?.acquired) {
      await client.query('ROLLBACK')
      return 0
    }
    const { rows } = await client.query<TimedOutInvocation>(
      `UPDATE agent_invocations
       SET status = 'timed_out',
           completed_at = now(),
           error_json = COALESCE(error_json, '{}'::jsonb)
                        || jsonb_build_object('reason', 'deadline_exceeded'),
           updated_at = now()
       WHERE status = 'running'
         AND deadline_at IS NOT NULL
         AND deadline_at < now()
       RETURNING id, zone_id, service_id`,
    )
    for (const row of rows) {
      await enqueue(client, Topics.InvocationsLifecycle,
        `invocation.timed_out:${row.id}`,
        { event: 'invocation.timed_out', zone_id: row.zone_id,
          service_id: row.service_id, invocation_id: row.id })
    }
    await client.query('COMMIT')
    return rows.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export interface DeadlineEnforcerHandle {
  stop: () => Promise<void>
}

export function startDeadlineEnforcer(
  db: Pool,
  intervalMs = cfg.deadlineSweepIntervalMs,
): DeadlineEnforcerHandle {
  let running = false
  let stopped = false
  let pending: Promise<unknown> = Promise.resolve()

  const tick = (): void => {
    if (stopped || running) return
    running = true
    pending = runDeadlineSweep(db)
      .catch((err) => {
        console.error('Deadline sweep failed:', err)
      })
      .finally(() => {
        running = false
      })
  }

  const timer = setInterval(tick, intervalMs)
  return {
    stop: async () => {
      stopped = true
      clearInterval(timer)
      await pending
    },
  }
}
