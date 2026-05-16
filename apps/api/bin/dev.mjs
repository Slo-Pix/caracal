#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// API dev launcher: stamps CARACAL_REPO_ROOT for explicit dev env-file loading,
// then execs tsx watch on src/main.ts.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
process.env.CARACAL_REPO_ROOT ??= resolve(here, '..', '..', '..')

const tsx = resolve(here, '..', 'node_modules', '.bin', 'tsx')
const child = spawn(tsx, ['watch', 'src/main.ts'], { stdio: 'inherit', env: process.env })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
