// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal up | down | status`: docker-compose lifecycle and health probes for the OSS stack.

import {
  DEFAULT_SERVICE_PROBES,
  resolveStackPaths,
  stackDown,
  stackStatus,
  stackUp,
  type StackMode,
  type StackPaths,
} from '@caracalai/engine'
import { CARACAL_MODE, CARACAL_REGISTRY, CARACAL_VERSION } from '../runtime/version.ts'
import { style, SYMBOL, printError, printInfo } from '../style.ts'

function resolveMode(): StackMode {
  const override = process.env.CARACAL_MODE
  if (override === 'dev' || override === 'runtime') return override
  if (override) {
    printError(`CARACAL_MODE must be 'dev' or 'runtime' (got '${override}')`)
    process.exit(1)
  }
  return CARACAL_MODE
}

export function resolvePaths(): StackPaths {
  try {
    return resolveStackPaths({ mode: resolveMode(), onInfo: printInfo })
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

function printBanner(paths: StackPaths): void {
  const tag =
    paths.mode === 'dev'
      ? `dev (sha ${process.env.CARACAL_DEV_SHA ?? 'unknown'})`
      : `runtime (${CARACAL_VERSION})`
  process.stdout.write(`${style.label('caracal mode:')} ${style.header(tag)}\n`)
}

function composeEnv(paths: StackPaths): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { CARACAL_MODE: paths.mode }
  if (paths.mode === 'runtime') {
    if (!process.env.CARACAL_VERSION) env.CARACAL_VERSION = CARACAL_VERSION
    if (!process.env.CARACAL_REGISTRY) env.CARACAL_REGISTRY = CARACAL_REGISTRY
  }
  if (paths.mode === 'dev' && !process.env.CARACAL_DEV_SHA) {
    env.CARACAL_DEV_SHA = 'nogit'
  }
  return env
}

export async function upCommand(argv: string[]): Promise<void> {
  const paths = resolvePaths()
  printBanner(paths)
  const handle = stackUp({ paths, args: argv, env: composeEnv(paths) })
  const code = await handle.exitCode
  process.exit(code)
}

export async function downCommand(argv: string[]): Promise<void> {
  const paths = resolvePaths()
  printBanner(paths)
  const handle = stackDown({ paths, args: argv, env: composeEnv(paths) })
  const code = await handle.exitCode
  process.exit(code)
}

export async function statusCommand(): Promise<void> {
  const paths = resolvePaths()
  printBanner(paths)
  const results = await stackStatus({ probes: DEFAULT_SERVICE_PROBES })
  const width = DEFAULT_SERVICE_PROBES.reduce((m, s) => Math.max(m, s.name.length), 0)
  let allOk = true
  process.stdout.write(
    `${style.header('service'.padEnd(width))}  ${style.header('port ')}  ${style.header('status')}  ${style.header('detail')}\n`,
  )
  for (const r of results) {
    if (!r.ok) allOk = false
    const mark = r.ok ? style.success(SYMBOL.ok) : style.error(SYMBOL.fail)
    const status = r.ok ? style.success('ok  ') : style.error('down')
    process.stdout.write(
      `${r.name.padEnd(width)}  ${String(r.port).padStart(5)}  ${mark} ${status}  ${style.label(r.detail)}\n`,
    )
  }
  process.exit(allOk ? 0 : 1)
}
