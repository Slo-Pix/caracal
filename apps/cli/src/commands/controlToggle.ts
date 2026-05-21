// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Interactive Control lifecycle commands for the engine-owned automation service.

import {
  applyControlLifecycleAction,
  authorizeControlManagementAccess,
  controlServiceStatus,
  type ControlLifecycleAction,
  type ControlLifecycleResult,
  type ControlServiceStatus,
} from '@caracalai/engine'
import { createInterface } from 'node:readline'
import type { CliConfig } from '../config.ts'
import { printError, printInfo, printStep, printSuccess, style } from '../style.ts'
import { fail, printJSON, showHelp } from './shared.ts'
import { composeEnv, resolvePaths } from './stack.ts'

const LIFECYCLE_ACTIONS = new Set<ControlLifecycleAction>(['mount', 'enable', 'disable', 'unmount'])

function controlHelp(): never {
  return showHelp([
    'Usage: caracal-cli control <mount|enable|disable|unmount|status|key|rotate|revoke> [--json]',
    '',
    'Manages the optional Control automation API through the engine.',
    'The endpoint is exposed only while enabled.',
    '',
    'Subcommands:',
    '  mount     Prepare Control for long-term availability without exposing the endpoint',
    '  enable    Start the mounted endpoint for authenticated automation',
    '  disable   Stop the endpoint but keep the mounted runtime for fast re-enable',
    '  unmount   Remove the Control runtime for long-term idle state',
    '  status    Show enablement, endpoint, health, and lifecycle details',
    '  key       Manage Control API credentials',
    '  rotate    Rotate a Control API credential secret',
    '  revoke    Delete a Control API credential',
    '',
    'Flags:',
    '  --json    Emit structured JSON for status after interactive authorization',
    '',
  ])
}

function parseToggleFlags(rest: string[]): { json: boolean } {
  let json = false
  for (const arg of rest) {
    if (arg === '--json') {
      json = true
      continue
    }
    printError(`unexpected argument: ${arg}`)
    process.exit(1)
  }
  return { json }
}

function printControlResult(result: ControlLifecycleResult): void {
  printSuccess(result.summary)
  printInfo(`state: ${formatState(result.state)}  runtime: ${style.label(result.service)}`)
  printInfo(`endpoint: ${formatEndpoint(result.enabled, result.invokeUrl)}`)
  printInfo(`lifecycle: ${result.lifecycle}`)
  printInfo(`optimization: ${result.optimization}`)
}

function formatState(state: ControlServiceStatus['state']): string {
  if (state === 'enabled') return style.success(state)
  if (state === 'disabled') return style.warn(state)
  return style.label(state)
}

function printControlStatus(status: ControlServiceStatus): void {
  const state = formatState(status.state)
  const service = status.service === 'ok'
    ? style.success(status.service)
    : status.service === 'gated' || status.service === 'unmounted'
      ? style.label(status.service)
      : style.error(status.service)
  printInfo(`Control: ${state}; service: ${service}; detail: ${style.label(status.detail)}`)
  printInfo(`endpoint: ${formatEndpoint(status.enabled, status.invokeUrl)}`)
  printInfo(`lifecycle: ${status.lifecycle}`)
  printInfo(`optimization: ${status.optimization}`)
  printInfo(`state file: ${style.label(status.marker)}`)
}

function formatEndpoint(enabled: boolean, invokeUrl: string): string {
  return enabled ? style.code(invokeUrl) : `${style.label('not exposed')} ${style.code(invokeUrl)}`
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolveAnswer) => {
    let settled = false
    const finish = (value: string) => {
      if (settled) return
      settled = true
      rl.close()
      resolveAnswer(value)
    }
    rl.question(question, (answer) => finish(answer.trim()))
    rl.once('close', () => finish(''))
  })
}

async function confirmLifecycleAction(action: ControlLifecycleAction): Promise<void> {
  process.stdout.write(
    [
      style.warn(`Control ${action} changes the managed Control API runtime.`),
      style.label(`Type "control ${action}" to confirm:`),
      '',
    ].join('\n'),
  )
  const answer = await prompt(style.prompt('> '))
  if (answer !== `control ${action}`) {
    printError('Control lifecycle action aborted.')
    process.exit(1)
  }
}

function lifecycleProgress(action: ControlLifecycleAction): string {
  if (action === 'enable') return 'opening endpoint gate'
  if (action === 'disable') return 'closing endpoint gate'
  if (action === 'unmount') return 'detaching Control runtime'
  return 'loading Control runtime'
}

export async function controlToggleCommand(argv: string[], _cfg?: CliConfig): Promise<void> {
  const [sub, ...rest] = argv
  if (!sub || sub === '--help' || sub === '-h') controlHelp()
  const { json } = parseToggleFlags(rest)
  try {
    authorizeControlManagementAccess()
  } catch (err) {
    fail(err)
  }
  if (LIFECYCLE_ACTIONS.has(sub as ControlLifecycleAction)) {
    const action = sub as ControlLifecycleAction
    if (json) {
      printError('--json is available only for control status; lifecycle changes are interactive only.')
      process.exit(1)
    }
    await confirmLifecycleAction(action)
    const paths = resolvePaths()
    if (!json) printStep(`control ${action}: ${lifecycleProgress(action)}`)
    const result = await applyControlLifecycleAction({
      paths,
      action,
      env: composeEnv(paths),
      onLine: () => {},
    })
    if (json) return printJSON(result)
    printControlResult(result)
    return
  }
  if (sub === 'status') {
    const paths = resolvePaths()
    const status = await controlServiceStatus({ paths, env: composeEnv(paths) })
    if (json) return printJSON(status)
    printControlStatus(status)
    return
  }
  printError(`unknown subcommand "${sub}"; run \`caracal-cli control --help\``)
  process.exit(1)
}
