// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal control enable|disable|status`: persists the on/off marker that gates the optional Control automation service on the next `caracal up`.

import { controlStateFile, isControlEnabled, setControlEnabled } from '@caracalai/engine'
import { printError, printInfo, printSuccess, style } from '../style.ts'
import { showHelp } from './shared.ts'

function controlHelp(): never {
  return showHelp([
    'Usage: caracal control <enable|disable|status>',
    '',
    'Toggles the optional Control automation API. The toggle is persisted in',
    '$CARACAL_HOME and applied on the next `caracal up`.',
    '',
    'Subcommands:',
    '  enable    Mark the Control service as enabled',
    '  disable   Mark the Control service as disabled',
    '  status    Print whether the Control service is enabled',
    '',
  ])
}

export function controlToggleCommand(argv: string[]): void {
  const [sub, ...rest] = argv
  if (!sub || sub === '--help' || sub === '-h') controlHelp()
  if (rest.length > 0) {
    printError(`unexpected argument: ${rest[0]}`)
    process.exit(1)
  }
  if (sub === 'enable') {
    setControlEnabled(true)
    printSuccess('Control service enabled. Run `caracal up` to start it.')
    return
  }
  if (sub === 'disable') {
    setControlEnabled(false)
    printSuccess('Control service disabled. Run `caracal up` to apply.')
    return
  }
  if (sub === 'status') {
    const on = isControlEnabled()
    const state = on ? style.success('enabled') : style.label('disabled')
    printInfo(`Control service: ${state} (marker: ${controlStateFile()})`)
    return
  }
  printError(`unknown subcommand "${sub}"; run \`caracal control --help\``)
  process.exit(1)
}
