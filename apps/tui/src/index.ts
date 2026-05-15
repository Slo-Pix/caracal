// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Caracal TUI entry point: bootstraps the AdminClient and launches the menu.

import '@caracalai/engine/scrubCwdEnv'
import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import {
  buildAdminClient,
} from '@caracalai/engine'
import {
  resolveCliConfigPath,
  type CliConfig,
} from '@caracalai/core/cli'
import { App } from './screen.ts'
import { CARACAL_TUI_VERSION } from './version.gen.ts'
import { MenuView } from './views/menu.ts'

function loadConfig(): CliConfig | undefined {
  const path = resolveCliConfigPath()
  if (!path) return undefined
  try { return parse(readFileSync(path, 'utf8')) as unknown as CliConfig } catch { return undefined }
}

function main(): void {
  const command = process.argv[2]
  if (command === '--version' || command === '-v' || command === 'version') {
    process.stdout.write(`caracal-tui ${CARACAL_TUI_VERSION}\n`)
    return
  }
  if (!process.stdin.isTTY) {
    process.stderr.write('caracal-tui: stdin is not a TTY — run from an interactive terminal.\n')
    process.exit(1)
  }
  const cfg = loadConfig()
  let adminCtx: import('@caracalai/engine').AdminContext
  try {
    adminCtx = buildAdminClient(cfg)
  } catch (err) {
    process.stderr.write(`caracal-tui: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
  const menu = new MenuView(adminCtx.client, adminCtx.zoneId)
  const app = new App('Caracal TUI', () => {
    const zid = menu.currentZoneId()
    return `${adminCtx.apiUrl}${zid ? `  zone:${zid}` : ''}`
  })
  void app.run(menu)
}

main()
