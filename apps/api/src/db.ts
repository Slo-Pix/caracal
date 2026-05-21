// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// PostgreSQL connection pool for the API service.

import pg from 'pg'

export type DB = pg.Pool
type QueryParam = string | number | boolean | null | string[]

export interface Queryable {
  query: <T = unknown>(text: string, params?: QueryParam[]) => Promise<{ rows: T[] }>
}

export interface DBOptions {
  connectionString: string
  max?: number
  statementTimeoutMs?: number
  idleInTxTimeoutMs?: number
  connectionTimeoutMs?: number
  idleTimeoutMs?: number
  applicationName?: string
  onZoneGUCError?: (err: unknown) => void
}

export function newDB(options: DBOptions): DB {
  const stmt = options.statementTimeoutMs ?? 15_000
  const idleTx = options.idleInTxTimeoutMs ?? 30_000
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 20,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    application_name: options.applicationName ?? 'caracal-api',
    options: `-c statement_timeout=${stmt} -c idle_in_transaction_session_timeout=${idleTx}`,
  })
  pool.on('connect', (client) => {
    client.query("SELECT set_config('caracal.zone_id', '*', false)").catch((err: unknown) => {
      if (options.onZoneGUCError) {
        options.onZoneGUCError(err)
      }
    })
  })
  return pool
}
