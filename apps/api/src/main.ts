// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// API service entrypoint.

import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { newDB } from './db.js'
import { newRedis } from './redis.js'
import { startDCRGC } from './jobs/dcr-gc.js'
import { runMigrations } from './migrate.js'

const cfg = loadConfig()
const db = newDB(cfg.databaseUrl)
const redis = newRedis(cfg.redisUrl)

await runMigrations(db, (msg) => process.stdout.write(`${msg}\n`))

const app = await buildApp({ cfg, db, redis })

startDCRGC(db)

try {
  await app.listen({ port: cfg.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
