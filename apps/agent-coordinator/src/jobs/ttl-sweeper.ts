// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TTL sweeper: terminates agent sessions past their configured TTL.

import type { Pool } from 'pg'
import { publishSessionRevocation, publishLifecycle } from '../redis.js'

export async function runTTLSweep(db: Pool): Promise<number> {
  const { rows } = await db.query(
    `UPDATE agent_sessions
     SET status = 'terminated', terminated_at = now()
     WHERE status = 'active'
       AND spawned_at + (ttl_seconds * interval '1 second') < now()
     RETURNING id, zone_id, session_sid`,
  )
  for (const row of rows) {
    await publishSessionRevocation(row.zone_id, row.session_sid)
    await publishLifecycle('terminate', row.zone_id, row.id, null)
  }
  return rows.length
}

export function startTTLSweeper(db: Pool, intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    runTTLSweep(db).catch((err) => {
      console.error('TTL sweep failed:', err)
    })
  }, intervalMs)
}
