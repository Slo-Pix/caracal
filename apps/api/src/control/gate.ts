// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Runtime gate that blocks Control invoke access while keeping the plugin loaded in the API.

import { existsSync } from 'node:fs'

export interface ControlGate {
  enabled(): boolean
}

export function fileGate(path: string | undefined): ControlGate {
  return {
    enabled: () => path !== undefined && existsSync(path),
  }
}
