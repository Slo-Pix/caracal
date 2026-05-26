#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Generates the Changesets ignore list from workspace package.json files and release.config.json.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readReleaseConfig, repoRoot } from './releaseInventory.mjs'

const workspaceRoots = ['apps', 'packages', 'docs']

function collectPackageJsons(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectPackageJsons(path, out)
      continue
    }
    if (entry.name === 'package.json') {
      try {
        const data = JSON.parse(readFileSync(path, 'utf8'))
        if (data.name) out.push({ path, name: data.name, private: Boolean(data.private) })
      } catch {}
    }
  }
}

function ignoreList() {
  const config = readReleaseConfig()
  const publishable = new Set(config.packages.npm.filter((entry) => entry.publish !== false).map((entry) => entry.name))
  const packages = []
  for (const root of workspaceRoots) {
    const path = join(repoRoot, root)
    try {
      statSync(path)
    } catch {
      continue
    }
    collectPackageJsons(path, packages)
  }
  const ignore = new Set()
  for (const pkg of packages) {
    if (pkg.private || !publishable.has(pkg.name)) ignore.add(pkg.name)
  }
  return [...ignore].sort()
}

function main() {
  const check = process.argv.includes('--check')
  const path = join(repoRoot, '.changeset/config.json')
  const before = readFileSync(path, 'utf8')
  const data = JSON.parse(before)
  data.ignore = ignoreList()
  const after = `${JSON.stringify(data, null, 2)}\n`
  if (after === before) {
    process.stdout.write('changesets ignore in sync\n')
    return
  }
  if (check) {
    process.stderr.write('changesets ignore drift; run pnpm release:changesets-ignore\n')
    process.exit(1)
  }
  writeFileSync(path, after)
  process.stdout.write(`updated ${path}\n`)
}

main()
