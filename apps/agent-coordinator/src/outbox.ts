// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Transactional outbox enqueue helper for coordinator-produced events.

import type { Pool, PoolClient } from 'pg'
import { v7 as uuidv7 } from 'uuid'

export type Queryable = Pick<Pool | PoolClient, 'query'>

export const Topics = {
  AgentsLifecycle: 'caracal.agents.lifecycle',
  SessionsRevoke: 'caracal.sessions.revoke',
  InvocationsLifecycle: 'caracal.invocations.lifecycle',
  DelegationsInvalidate: 'caracal.delegations.invalidate',
} as const

export type Topic = typeof Topics[keyof typeof Topics]

export async function enqueue(
  db: Queryable,
  topic: Topic,
  dedupeKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO caracal_outbox (id, producer, topic, dedupe_key, payload_json)
     VALUES ($1, 'coordinator', $2, $3, $4)
     ON CONFLICT (producer, topic, dedupe_key) DO NOTHING`,
    [uuidv7(), topic, dedupeKey, payload],
  )
}
