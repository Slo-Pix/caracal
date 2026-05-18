// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Persisted on/off state for the optional Control automation surface.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runtimePaths } from './runtime.js'

const MARKER = 'control.enabled'

export function controlStateFile(home: string = runtimePaths().home): string {
  return join(home, MARKER)
}

export function isControlEnabled(home?: string): boolean {
  return existsSync(controlStateFile(home))
}

export function setControlEnabled(value: boolean, home?: string): void {
  const file = controlStateFile(home)
  if (value) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, '', { mode: 0o644 })
    return
  }
  if (existsSync(file)) rmSync(file, { force: true })
}
