// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Delegation graph epoch persistence helpers.

import type { PoolClient } from 'pg'

export async function bumpDelegationEpoch(db: PoolClient, zoneId: string): Promise<number> {
  const { rows } = await db.query<{ epoch: string }>(
    `INSERT INTO delegation_graph_epochs (zone_id, epoch, updated_at)
     VALUES ($1, 1, now())
     ON CONFLICT (zone_id) DO UPDATE
     SET epoch = delegation_graph_epochs.epoch + 1, updated_at = now()
     RETURNING epoch`,
    [zoneId],
  )
  return Number(rows[0].epoch)
}
