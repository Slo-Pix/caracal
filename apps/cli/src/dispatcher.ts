// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared dispatcher kernel: builds usage text and routes argv through a CommandRegistry with whitelist enforcement, used by both the shell and the CLI binaries.

import { COMMAND_NAME_PATTERN, type CommandGroup } from '@caracalai/core/commands'
import { parse } from 'smol-toml'
import { readFileSync } from 'node:fs'
import { resolveCliConfigPath } from '@caracalai/core/cli'
import { style, printError } from './style.ts'
import type { CommandRegistry } from './registry.ts'
import type { CliConfig } from './config.ts'

const GROUP_TITLES: Record<CommandGroup, string> = {
  shell: 'Shell:',
  stack: 'Stack:',
  runtime: 'Runtime:',
  admin: 'Admin:',
  observability: 'Observability:',
  multiagent: 'Multi-agent (requires CARACAL_COORDINATOR_TOKEN):',
  control: 'Agent control surface:',
}

export interface DispatchOptions {
  readonly binary: string
  readonly version: string
  readonly mode: 'dev' | 'runtime'
  readonly registry: CommandRegistry
  readonly extras?: readonly string[]
  readonly loadConfig?: boolean
}

function loadConfig(required: boolean): CliConfig | undefined {
  const path = resolveCliConfigPath()
  if (!path) {
    if (!required) return undefined
    printError('caracal.toml not found; create a zone (`caracal-cli zone create --name <n>`), an application (`caracal-cli app create --name <n>`), then author caracal.toml with the returned ids and client secret.')
    process.exit(1)
  }
  try {
    return parse(readFileSync(path, 'utf8')) as unknown as CliConfig
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    printError(`failed to parse ${path}: ${reason}`)
    process.exit(1)
  }
}

export function loadCliConfig(required: boolean): CliConfig | undefined {
  return loadConfig(required)
}

export function printUsage(opts: DispatchOptions, out: NodeJS.WriteStream = process.stderr): void {
  const H = (s: string) => style.header(s)
  const L = (s: string) => style.label(s)
  const lines: string[] = [`${style.title('Usage:')} ${opts.binary} <command> [options]`, '']
  const groups = new Map<CommandGroup, typeof opts.registry.ordered>()
  for (const b of opts.registry.ordered) {
    if (b.descriptor.hidden) continue
    const list = (groups.get(b.descriptor.group) ?? []) as Array<typeof b>
    list.push(b)
    groups.set(b.descriptor.group, list)
  }
  for (const group of Object.keys(GROUP_TITLES) as CommandGroup[]) {
    const items = groups.get(group)
    if (!items || items.length === 0) continue
    lines.push(H(GROUP_TITLES[group]))
    for (const b of items) lines.push(`  ${b.descriptor.name.padEnd(24)} ${b.descriptor.summary}`)
    lines.push('')
  }
  if (opts.extras && opts.extras.length > 0) {
    for (const line of opts.extras) lines.push(line)
    lines.push('')
  }
  lines.push(
    H('Common flags:'),
    '  --help, -h               Show this help',
    '  --version, -v            Show version',
    '',
    H('Environment:'),
    `  ${L('NO_COLOR / FORCE_COLOR')}   Disable / force terminal colors`,
    '',
  )
  out.write(lines.join('\n'))
}

export async function dispatch(opts: DispatchOptions, rawArgs: readonly string[]): Promise<void> {
  const argv = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs
  const command = argv[0]
  const rest = argv.slice(1)

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printUsage(opts, process.stdout)
    process.exit(0)
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    const tag = opts.mode === 'dev' ? `dev (sha ${process.env.CARACAL_DEV_SHA ?? 'unknown'})` : 'runtime'
    process.stdout.write(`${opts.binary} ${opts.version} [${tag}]\n`)
    process.exit(0)
  }
  if (!COMMAND_NAME_PATTERN.test(command) || !opts.registry.byName.has(command)) {
    printError('unknown command')
    printUsage(opts, process.stderr)
    process.exit(1)
  }

  const binding = opts.registry.byName.get(command)!
  const cfg = opts.loadConfig ? loadConfig(binding.descriptor.requiresConfig ?? false) : undefined
  await binding.run(rest, cfg)
}
