#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Workspace entry point: locates the repo root by walking up from cwd and delegates to the workspace CLI.

import { existsSync } from 'fs'
import { dirname, join } from 'path'

function findRepoRoot(start) {
  let dir = start
  while (true) {
    if (existsSync(join(dir, 'apps/cli/bin/caracal.mjs'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const start = process.env.INIT_CWD || process.env.PWD || process.cwd()
const root = findRepoRoot(start)

if (!root) {
  process.stderr.write(
    'caracal: this binary is the pnpm workspace shim and only runs inside the Caracal monorepo.\n' +
      'If you installed the released CLI, remove the pnpm symlink so the installed binary wins:\n' +
      '  pnpm rm -g caracal   # or: rm "$(pnpm bin -g)/caracal"\n',
  )
  process.exit(1)
}

process.env.CARACAL_REPO_ROOT = root

import(join(root, 'apps/cli/bin/caracal.mjs')).catch((err) => {
  process.stderr.write(`caracal: ${err?.message ?? err}\n`)
  process.exit(1)
})
