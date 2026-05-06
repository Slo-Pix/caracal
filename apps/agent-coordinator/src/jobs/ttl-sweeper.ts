// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TTL sweeper: terminates expired agents transactionally with outbox events.

import type { Pool } from 'pg'
import { cfg } from '../config.js'
import { enqueue, Topics } from '../outbox.js'

const SWEEP_LOCK = 'coordinator:ttl_sweep'

interface ExpiredAgent {
  id: string
  zone_id: string
  session_sid: string
  parent_id: string | null
}

export async function runTTLSweep(db: Pool): Promise<number> {
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
    const { rows } = await client.query<ExpiredAgent>(
      `UPDATE agent_sessions
       SET status = 'terminated', terminated_at = now()
       WHERE status = 'active'
         AND spawned_at + (ttl_seconds * interval '1 second') < now()
       RETURNING id, zone_id, session_sid, parent_id`,
    )
    for (const row of rows) {
      await enqueue(client, Topics.SessionsRevoke,
        `agent_ttl:${row.id}`,
        { zone_id: row.zone_id, session_id: row.session_sid, reason: 'ttl' })
      await enqueue(client, Topics.AgentsLifecycle,
        `terminate:${row.id}`,
        { event: 'terminate', zone_id: row.zone_id, session_id: row.id,
          parent_id: row.parent_id, reason: 'ttl' })
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

export interface TTLSweeperHandle {
  stop: () => Promise<void>
}

export function startTTLSweeper(db: Pool, intervalMs = cfg.ttlSweepIntervalMs): TTLSweeperHandle {
  let running = false
  let stopped = false
  let pending: Promise<unknown> = Promise.resolve()

  const tick = (): void => {
    if (stopped || running) return
    running = true
    pending = runTTLSweep(db)
      .catch((err) => {
        console.error('TTL sweep failed:', err)
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
