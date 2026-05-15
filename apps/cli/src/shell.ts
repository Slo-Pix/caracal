// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal`: thin top-level shell that owns stack lifecycle commands and dispatches cli/tui to their sibling binaries.

import '@caracalai/engine/scrubCwdEnv'
import { upCommand, downCommand, statusCommand } from './commands/stack.ts'
import { purgeCommand } from './commands/purge.ts'
import { cliDispatch, tuiDispatch } from './commands/dispatch.ts'
import { CARACAL_MODE, CARACAL_VERSION } from './runtime/version.ts'
import { SHELL_COMMANDS } from '@caracalai/core/commands'
import { buildRegistry, type Executor } from './registry.ts'
import { dispatch } from './dispatcher.ts'

const executors: Record<string, Executor> = {
  up: (argv) => upCommand([...argv]),
  down: (argv) => downCommand([...argv]),
  status: () => statusCommand(),
  purge: (argv) => purgeCommand([...argv]),
  cli: (argv) => { cliDispatch([...argv]) },
  tui: (argv) => { tuiDispatch([...argv]) },
}

const registry = buildRegistry(SHELL_COMMANDS, executors)

await dispatch(
  {
    binary: 'caracal',
    version: CARACAL_VERSION,
    mode: CARACAL_MODE,
    registry,
  },
  process.argv.slice(2),
)
