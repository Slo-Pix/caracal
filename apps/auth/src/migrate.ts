// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Creates or updates the authentication database schema for the configured backend.

import { getMigrations } from 'better-auth/db/migration'

import { auth } from './auth.ts'
import { closeAuthDatabase, ensureAuthDatabase } from './database.ts'
import { logger } from './logger.ts'

// The dedicated migration entrypoint owns auth-schema provisioning end to end: it creates the
// auth database when absent and applies the Better Auth schema, then exits. Production runs it
// once as a pre-rollout job so no serving replica performs DDL under horizontal scaling.
async function migrate(): Promise<void> {
  await ensureAuthDatabase()
  const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(auth.options)
  if (toBeCreated.length === 0 && toBeAdded.length === 0) {
    logger.info('auth schema already up to date')
    return
  }
  await runMigrations()
  logger.info('auth schema migrated')
}

try {
  await migrate()
  await closeAuthDatabase()
  process.exit(0)
} catch (err) {
  logger.error('auth migration failed', { err })
  await closeAuthDatabase().catch(() => {})
  process.exit(1)
}
