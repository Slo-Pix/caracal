// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service entry point: launches the managed Control HTTP surface with an internal endpoint gate.

import { assertPublishedSafe, createLogger, initNodeTelemetry } from '@caracalai/core'
import { loadConfig } from './config.js'
import { buildServer } from './server.js'

assertPublishedSafe()

async function main(): Promise<void> {
  const enabled = process.env.CARACAL_CONTROL_ENABLED
  const bootLog = createLogger('control', (process.env.LOG_LEVEL as 'info') ?? 'info')
  if (enabled !== 'true') {
    bootLog.info('control runtime not mounted; mount through caracal-cli or the TUI Control menu', { enabled: enabled ?? '' })
    return
  }

  let cfg
  try {
    cfg = loadConfig()
  } catch (err) {
    bootLog.error('control config invalid', { err: String(err) })
    process.exit(1)
  }

  const log = createLogger('control', cfg.logLevel as 'info')
  const shutdownTelemetry = initNodeTelemetry('caracal-control', { error: (msg, meta) => log.error(msg, meta) })
  const { app, close } = await buildServer(cfg, log)

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    log.info('shutdown requested', { signal })
    try {
      await close()
      await shutdownTelemetry()
    } catch (err) {
      log.error('graceful shutdown failed', { err: String(err) })
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
  process.on('SIGINT', () => { void shutdown('SIGINT') })
  process.on('unhandledRejection', (reason) => {
    log.error('unhandledRejection', { reason: String(reason) })
    process.exit(1)
  })
  process.on('uncaughtException', (err) => {
    log.error('uncaughtException', { err: err.stack ?? err.message })
    process.exit(1)
  })

  try {
    await app.listen({ port: cfg.port, host: cfg.host })
    log.info('control surface listening', { port: cfg.port, host: cfg.host })
  } catch (err) {
    log.error('listen failed', { err: String(err) })
    process.exit(1)
  }
}

void main()
