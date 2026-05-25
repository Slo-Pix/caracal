#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Detects publishable npm and PyPI packages selected by git history.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function die(message) {
  process.stderr.write(`detectChangedPackages: ${message}\n`)
  process.exit(1)
}

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', options.stderr ?? 'pipe'] }).trim()
}

function parseArgs(argv) {
  const options = {
    all: false,
    base: '',
    ecosystem: 'all',
    format: 'json',
    head: 'HEAD',
    packages: new Set(),
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--all':
        options.all = true
        break
      case '--base':
        options.base = argv[++i] ?? ''
        if (!options.base) die('--base requires a git ref')
        break
      case '--ecosystem':
        options.ecosystem = argv[++i] ?? ''
        if (!['all', 'npm', 'pypi'].includes(options.ecosystem)) die('--ecosystem must be all, npm, or pypi')
        break
      case '--format':
        options.format = argv[++i] ?? ''
        if (!['json', 'paths', 'names', 'github-matrix'].includes(options.format)) die('--format must be json, paths, names, or github-matrix')
        break
      case '--head':
        options.head = argv[++i] ?? ''
        if (!options.head) die('--head requires a git ref')
        break
      case '--package':
        options.packages.add(argv[++i] ?? '')
        if (options.packages.has('')) die('--package requires a package id, name, or directory')
        break
      case '-h':
      case '--help':
        process.stdout.write(`Usage: scripts/detectChangedPackages.mjs [options]

Options:
  --all                    Return every publishable package.
  --base REF               Diff base ref. Defaults to the latest reachable release tag before --head.
                           Fails if no base can be found unless --all is set.
  --head REF               Diff head ref. Defaults to HEAD.
  --ecosystem all|npm|pypi Package ecosystem to print. Defaults to all.
  --format json|paths|names|github-matrix
                           Output format. Defaults to json.
  --package VALUE          Limit output to package id, package name, or directory. Repeatable.
`)
        process.exit(0)
      default:
        die(`unknown arg: ${arg}`)
    }
  }
  return options
}

function posix(path) {
  return path.split(sep).join('/')
}

function walk(dir, fileName, found = []) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '__pycache__') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(path, fileName, found)
    } else if (entry.isFile() && entry.name === fileName) {
      found.push(path)
    }
  }
  return found
}

function packageId(ecosystem, dir, name) {
  const parts = dir.split('/')
  if (parts[0] !== 'packages') return name.replace(/^@caracalai\//, '').replace(/^caracalai-/, '')
  if (parts[1] === 'connectors') return parts[2]
  if (parts[1] === 'transport') return `transport-${parts[2]}`
  return parts[1]
}

function npmPackages() {
  return walk(join(repoRoot, 'packages'), 'package.json')
    .map((path) => {
      const pkg = JSON.parse(readFileSync(path, 'utf8'))
      const dir = posix(relative(repoRoot, dirname(path)))
      return { ecosystem: 'npm', id: packageId('npm', dir, pkg.name), dir, name: pkg.name, version: pkg.version, private: Boolean(pkg.private), publishConfig: pkg.publishConfig }
    })
    .filter((pkg) => pkg.name?.startsWith('@caracalai/') && !pkg.private && pkg.publishConfig)
    .sort((a, b) => a.dir.localeCompare(b.dir))
}

function pypiPackages() {
  return walk(join(repoRoot, 'packages'), 'pyproject.toml')
    .map((path) => {
      const text = readFileSync(path, 'utf8')
      const name = text.match(/^name = "([^"]+)"/m)?.[1]
      const version = text.match(/^version = "([^"]+)"/m)?.[1]
      const dir = posix(relative(repoRoot, dirname(path)))
      return { ecosystem: 'pypi', id: packageId('pypi', dir, name ?? ''), dir, name, version }
    })
    .filter((pkg) => pkg.name?.startsWith('caracalai-') && pkg.version)
    .sort((a, b) => a.dir.localeCompare(b.dir))
}

function headCommit(head) {
  try {
    return git(['rev-parse', '--verify', `${head}^{commit}`])
  } catch {
    die(`head ref not found: ${head}`)
  }
}

function explicitBase(base) {
  try {
    return git(['rev-parse', '--verify', `${base}^{commit}`])
  } catch {
    die(`base ref not found: ${base}`)
  }
}

function defaultBase(head) {
  const commit = headCommit(head)
  let tags = []
  try {
    tags = git(['tag', '--merged', commit, '--list', 'v*', '--sort=-creatordate'], { stderr: 'ignore' }).split('\n').filter(Boolean)
  } catch {
    tags = []
  }
  for (const tag of tags) {
    const tagCommit = git(['rev-list', '-n', '1', tag])
    if (tagCommit !== commit) return tag
  }
  return ''
}

function diffFiles(base, head) {
  if (!base) return []
  return git(['diff', '--name-only', '--diff-filter=ACMRTUXB', base, head, '--'], { stderr: 'inherit' })
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean)
}

function packageTouched(pkg, files) {
  return files.some((path) => path === pkg.dir || path.startsWith(`${pkg.dir}/`))
}

function selectPackages(packages, options, files) {
  const selected = options.all ? packages : packages.filter((pkg) => packageTouched(pkg, files))
  if (!options.packages.size) return selected
  return selected.filter((pkg) => options.packages.has(pkg.id) || options.packages.has(pkg.name) || options.packages.has(pkg.dir))
}

function packageInventory(options) {
  const packages = {}
  if (options.ecosystem === 'all' || options.ecosystem === 'npm') packages.npm = npmPackages()
  if (options.ecosystem === 'all' || options.ecosystem === 'pypi') packages.pypi = pypiPackages()
  return packages
}

function outputPackages(packages) {
  return Object.values(packages).flat()
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const base = options.all ? '' : (options.base || defaultBase(options.head))
  if (!options.all && !base) die('no release tag base found; pass --base REF or --all')
  if (options.base) explicitBase(options.base)
  const head = headCommit(options.head)
  const files = options.all ? [] : diffFiles(base, head)
  const packages = Object.fromEntries(
    Object.entries(packageInventory(options)).map(([ecosystem, list]) => [ecosystem, selectPackages(list, options, files)]),
  )
  const flat = outputPackages(packages)

  switch (options.format) {
    case 'json':
      process.stdout.write(`${JSON.stringify({ base: base || null, head, changedFiles: files, packages }, null, 2)}\n`)
      break
    case 'paths':
      process.stdout.write(flat.map((pkg) => pkg.dir).join('\n'))
      if (flat.length) process.stdout.write('\n')
      break
    case 'names':
      process.stdout.write(flat.map((pkg) => pkg.name).join('\n'))
      if (flat.length) process.stdout.write('\n')
      break
    case 'github-matrix':
      process.stdout.write(`${JSON.stringify({ include: flat.map(({ private: _, publishConfig: __, ...pkg }) => pkg) })}\n`)
      break
  }
}

main()
