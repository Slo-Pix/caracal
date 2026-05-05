// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Transactional outbox publisher for coordinator Redis events.

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'

const INTERVAL_MS = 1000
const BATCH_SIZE = 50

export function startOutboxPublisher(db: Pool, redis: Redis): NodeJS.Timeout {
  return setInterval(() => {
    publishBatch(db, redis).catch((err) => {
      console.error('Outbox batch publish failed:', err)
    })
  }, INTERVAL_MS)
}

async function publishBatch(db: Pool, redis: Redis): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{
      id: string
      topic: string
      payload_json: Record<string, unknown>
    }>(
      `SELECT id, topic, payload_json
       FROM caracal_outbox
       WHERE producer = 'coordinator'
         AND status = 'pending'
         AND available_at <= now()
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE],
    )
    for (const row of rows) {
      try {
        await redis.xadd(row.topic, '*', ...redisFields(row.payload_json))
        await client.query(
          `UPDATE caracal_outbox
           SET status = 'published', attempts = attempts + 1, published_at = now(), updated_at = now()
           WHERE id = $1`,
          [row.id],
        )
      } catch {
        await client.query(
          `UPDATE caracal_outbox
           SET attempts = attempts + 1,
               status = CASE WHEN attempts + 1 >= 10 THEN 'dead' ELSE 'pending' END,
               available_at = now() + ((attempts + 1) * interval '1 second'),
               updated_at = now()
           WHERE id = $1`,
          [row.id],
        )
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

function redisFields(payload: Record<string, unknown>): string[] {
  return Object.entries(payload).flatMap(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ])
}
