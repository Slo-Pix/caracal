// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Caracal CLI entry point — `caracal init`, `caracal run`, `caracal credential read`.

import { parse } from 'smol-toml'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'node:os'
import { join } from 'path'
import { runCommand } from './commands/run.ts'
import { credentialReadCommand } from './commands/credential.ts'
import { initCommand } from './commands/init.ts'
import { upCommand, downCommand, statusCommand } from './commands/stack.ts'
import { checkMcpGovernance } from './mcp.ts'
import type { CliConfig } from './config.ts'

function usage(): void {
  process.stderr.write(
    'Usage: caracal <up | down | status | init [flags] | run <cmd...> | credential read <resource>>\n',
  )
}

function resolveConfigPath(): string | undefined {
  const candidates: string[] = []
  if (process.env.CARACAL_CONFIG) candidates.push(process.env.CARACAL_CONFIG)
  for (const dir of [process.cwd(), process.env.PWD, process.env.INIT_CWD]) {
    if (dir) candidates.push(join(dir, 'caracal.toml'))
  }
  const xdg = process.env.XDG_CONFIG_HOME
  const xdgBase = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config')
  candidates.push(join(xdgBase, 'caracal', 'caracal.toml'))

  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return undefined
}

function loadConfig(): CliConfig {
  try {
    const path = resolveConfigPath()
    if (!path) throw new Error('missing_config')
    const raw = readFileSync(path, 'utf8')
    return parse(raw) as unknown as CliConfig
  } catch {
    process.stderr.write('Error: caracal.toml not found; run `caracal init` to provision the local zone.\n')
    process.exit(1)
  }
}

const argv = process.argv.slice(2)
const cliArgs = argv[0] === '--' ? argv.slice(1) : argv
const [command, ...rest] = cliArgs

if (!command) {
  usage()
  process.exit(0)
}

if (command === 'init') {
  await initCommand(rest)
} else if (command === 'up') {
  await upCommand(rest)
} else if (command === 'down') {
  await downCommand(rest)
} else if (command === 'status') {
  await statusCommand()
} else if (command === 'run') {
  const cfg = loadConfig()
  const [cmd] = rest
  if (cmd) checkMcpGovernance(cmd, cfg)
  await runCommand(rest, cfg)
} else if (command === 'credential' && rest[0] === 'read') {
  const cfg = loadConfig()
  await credentialReadCommand(rest[1] ?? '', cfg)
} else {
  usage()
  process.exit(1)
}
