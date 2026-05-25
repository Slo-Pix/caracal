#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// rc workflow for versioning and manifests.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const npmPaths = [
  'packages/core/ts',
  'packages/oauth/ts',
  'packages/admin/ts',
  'packages/identity/ts',
  'packages/revocation/ts',
  'packages/sdk/ts',
  'packages/transport/mcp/ts',
  'packages/transport/a2a/ts',
  'packages/connectors/express/ts',
  'packages/connectors/fastmcp/ts',
  'packages/connectors/postgres/ts',
  'packages/connectors/redis/ts',
]

const pyPaths = [
  'packages/core/python',
  'packages/oauth/python',
  'packages/identity/python',
  'packages/revocation/python',
  'packages/sdk/python',
  'packages/transport/mcp/python',
  'packages/connectors/fastmcp/python',
  'packages/connectors/redis/python',
]

const containers = ['api', 'coordinator', 'control', 'audit', 'gateway', 'sts', 'postgres', 'redis']
const archiveTargets = [
  'caracal-shell-linux-amd64',
  'caracal-shell-linux-arm64',
  'caracal-shell-darwin-amd64',
  'caracal-shell-darwin-arm64',
  'caracal-shell-windows-amd64',
  'caracal-console-linux-amd64',
  'caracal-console-linux-arm64',
  'caracal-console-darwin-amd64',
  'caracal-console-darwin-arm64',
  'caracal-console-windows-amd64',
]
const imageBuilds = [
  ['api', '.', 'apps/api/Dockerfile'],
  ['sts', '.', 'infra/docker/Dockerfile.go-service'],
  ['gateway', '.', 'infra/docker/Dockerfile.go-service'],
  ['audit', '.', 'infra/docker/Dockerfile.go-service'],
  ['coordinator', '.', 'apps/coordinator/Dockerfile'],
  ['control', '.', 'apps/control/Dockerfile'],
  ['postgres', 'infra/postgres', 'infra/postgres/Dockerfile'],
  ['redis', 'infra/redis', 'infra/redis/Dockerfile'],
  ['runtime', '.', 'apps/runtime/Dockerfile'],
]

function die(message) {
  process.stderr.write(`rc: ${message}\n`)
  process.exit(1)
}

function say(message = '') {
  process.stdout.write(`${message}\n`)
}

function parseArgs(argv) {
  const args = { command: argv[0], values: {}, flags: new Set() }
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) die(`unexpected positional argument: ${arg}`)
    const key = arg.slice(2)
    if (['base-version', 'manifest', 'npm-registry', 'pypi-index', 'oci-registry', 'github-release-base', 'suffix', 'ref'].includes(key)) {
      args.values[key] = argv[++i]
      if (!args.values[key]) die(`--${key} requires a value`)
    } else {
      args.flags.add(key)
    }
  }
  return args
}

function shortSha() {
  if (process.env.CARACAL_SHA) return process.env.CARACAL_SHA
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function dirtyTree() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function currentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function headSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function remoteSha(ref) {
  const refs = [`refs/heads/${ref}`, `refs/tags/${ref}`]
  for (const candidate of refs) {
    const out = execFileSync('git', ['ls-remote', 'origin', candidate], { cwd: repoRoot, encoding: 'utf8' }).trim()
    if (out) return out.split(/\s+/, 1)[0]
  }
  return ''
}

function currentCalVer() {
  const date = new Date()
  return `${date.getUTCFullYear()}.${`${date.getUTCMonth() + 1}`.padStart(2, '0')}.${`${date.getUTCDate()}`.padStart(2, '0')}`
}

function cleanBase(version) {
  if (/([+-]dev\.|-dev\.sha|-rc\.|rc\d+)/i.test(version)) die(`base version is already suffixed: ${version}`)
  return version
}

function npmRcBase(version, suffix) {
  if (version.endsWith(`-${suffix}`)) return version.slice(0, -suffix.length - 1)
  return cleanBase(version)
}

function pythonRcBase(version, suffix) {
  const numeric = suffix.match(/^rc\.([0-9]+)$/)?.[1]
  const sha = suffix.match(/^rc\.sha([A-Za-z0-9]+)$/)?.[1]
  if (numeric && version.endsWith(`rc${numeric}`)) return version.slice(0, -`rc${numeric}`.length)
  if (sha && version.endsWith(`rc0+sha${sha}`)) return version.slice(0, -`rc0+sha${sha}`.length)
  return cleanBase(version)
}

function rcSuffix(options) {
  return options.suffix ?? process.env.CARACAL_SUFFIX ?? `rc.sha${shortSha()}`
}

function npmRcVersion(version, suffix) {
  if (version.endsWith(`-${suffix}`)) return version
  return `${cleanBase(version)}-${suffix}`
}

function pythonRcVersion(version, suffix) {
  const numeric = suffix.match(/^rc\.([0-9]+)$/)?.[1]
  const sha = suffix.match(/^rc\.sha([A-Za-z0-9]+)$/)?.[1]
  if (numeric && version.endsWith(`rc${numeric}`)) return version
  if (sha && version.endsWith(`rc0+sha${sha}`)) return version
  const base = cleanBase(version)
  if (numeric) return `${base}rc${numeric}`
  if (sha) return `${base}rc0+sha${sha}`
  die(`unsupported Python rc suffix: ${suffix}; use rc.<number> or rc.sha<gitsha>`)
}

function readPackageVersions(paths, suffix) {
  return Object.fromEntries(paths.map((path) => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, path, 'package.json'), 'utf8'))
    if (!pkg.name || !pkg.version) die(`missing name or version in ${path}/package.json`)
    return [pkg.name, npmRcBase(pkg.version, suffix)]
  }))
}

function readPythonVersions(paths, suffix) {
  return Object.fromEntries(paths.map((path) => {
    const text = readFileSync(join(repoRoot, path, 'pyproject.toml'), 'utf8')
    const name = text.match(/^name = "([^"]+)"/m)?.[1]
    const version = text.match(/^version = "([^"]+)"/m)?.[1]
    if (!name || !version) die(`missing name or version in ${path}/pyproject.toml`)
    return [name, pythonRcBase(version, suffix)]
  }))
}

function registries(options) {
  return {
    npm: options['npm-registry'] ?? process.env.CARACAL_NPM_REGISTRY ?? 'https://registry.npmjs.org/',
    pypi: options['pypi-index'] ?? process.env.CARACAL_PYPI_INDEX ?? 'https://pypi.org/simple/',
    oci: options['oci-registry'] ?? process.env.CARACAL_OCI_REGISTRY ?? 'ghcr.io/garudex-labs',
    githubReleases: options['github-release-base'] ?? process.env.CARACAL_GITHUB_RELEASE_BASE ?? 'https://github.com/Garudex-Labs/caracal/releases/download',
  }
}

function helmChartVersion(value) {
  const [core, pre] = value.split('-', 2)
  const parts = core.split('.')
  const recut = parts[3]
  const base = `${Number(parts[0])}.${Number(parts[1])}.${Number(parts[2])}`
  return `${base}${pre ? `-${pre}` : ''}${recut ? `+${recut}` : ''}`
}

function makeManifest(options = {}) {
  const sha = shortSha()
  const suffix = rcSuffix(options)
  const baseVersion = cleanBase(options['base-version'] ?? process.env.CARACAL_BASE_VERSION ?? currentCalVer())
  const version = `${baseVersion}-${suffix}`
  const tag = `v${version}`
  const npm = Object.fromEntries(Object.entries(readPackageVersions(npmPaths, suffix)).map(([name, base]) => [name, npmRcVersion(base, suffix)]))
  const pypi = Object.fromEntries(Object.entries(readPythonVersions(pyPaths, suffix)).map(([name, base]) => [name, pythonRcVersion(base, suffix)]))
  const reg = registries(options)
  return {
    release: tag,
    mode: 'rc',
    version,
    baseVersion,
    suffix,
    sha,
    generatedAt: new Date().toISOString(),
    source: {
      gitSha: sha,
      dirty: Boolean(dirtyTree()),
    },
    registries: reg,
    binaries: { shell: version, console: version },
    runtimeImage: version,
    containers: Object.fromEntries(containers.map((name) => [name, version])),
    helm: { chartVersion: helmChartVersion(version), appVersion: version, imageTag: version },
    images: Object.fromEntries([...containers, 'runtime'].map((name) => [name, `${reg.oci.replace(/\/$/, '')}/caracal-${name}:v${version}`])),
    npm,
    pypi,
    githubRelease: {
      tag,
      assets: `${reg.githubReleases.replace(/\/$/, '')}/${tag}`,
    },
  }
}

function manifestPath(manifest) {
  return join(repoRoot, 'releases', manifest.release, 'manifest.json')
}

function writeManifest(manifest) {
  const path = manifestPath(manifest)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  return path
}

function loadManifest(pathOrTag) {
  if (pathOrTag) {
    const path = pathOrTag.endsWith('.json') ? resolve(pathOrTag) : join(repoRoot, 'releases', pathOrTag, 'manifest.json')
    if (!existsSync(path)) die(`manifest not found: ${path}`)
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  const root = join(repoRoot, 'releases')
  if (!existsSync(root)) die('no rc manifest found; run scripts/rc.sh version first')
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /-rc\./.test(entry.name) && existsSync(join(root, entry.name, 'manifest.json')))
    .map((entry) => ({ name: entry.name, time: statSync(join(root, entry.name, 'manifest.json')).mtimeMs }))
    .sort((a, b) => a.time - b.time)
  if (!entries.length) die('no rc manifest found; run scripts/rc.sh version first')
  return JSON.parse(readFileSync(join(root, entries.at(-1).name, 'manifest.json'), 'utf8'))
}

function rewritePackageJson(path, versions) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  if (versions[pkg.name]) pkg.version = versions[pkg.name]
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
    if (!pkg[field]) continue
    for (const name of Object.keys(pkg[field])) {
      if (versions[name]) pkg[field][name] = versions[name]
    }
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

function rewritePyproject(path, versions) {
  let text = readFileSync(path, 'utf8')
  const name = text.match(/^name = "([^"]+)"/m)?.[1]
  if (name && versions[name]) text = text.replace(/^version = "[^"]+"/m, `version = "${versions[name]}"`)
  text = text.replace(/"(?<name>caracalai-[a-z0-9-]+)==[^"]+"/g, (match, pkgName) => {
    if (!versions[pkgName]) return match
    return `"${pkgName}==${versions[pkgName]}"`
  })
  writeFileSync(path, text)
}

function rewriteHelm(manifest) {
  const chartPath = join(repoRoot, 'infra/helm/caracal/Chart.yaml')
  const valuesPath = join(repoRoot, 'infra/helm/caracal/values.yaml')
  let chart = readFileSync(chartPath, 'utf8')
  let values = readFileSync(valuesPath, 'utf8')
  chart = chart.replace(/^version: .*/m, `version: ${manifest.helm.chartVersion}`)
  chart = chart.replace(/^appVersion: .*/m, `appVersion: "${manifest.helm.appVersion}"`)
  values = values.replace(/^  tag: .*/m, `  tag: "${manifest.helm.imageTag}"`)
  writeFileSync(chartPath, chart)
  writeFileSync(valuesPath, values)
}

function prepare(options) {
  if (dirtyTree() && !options.flags.has('allow-dirty')) die('working tree is dirty; commit/stash first or pass --allow-dirty')
  const manifest = makeManifest(options.values)
  const path = writeManifest(manifest)
  for (const pkgPath of npmPaths) rewritePackageJson(join(repoRoot, pkgPath, 'package.json'), manifest.npm)
  for (const pyPath of pyPaths) rewritePyproject(join(repoRoot, pyPath, 'pyproject.toml'), manifest.pypi)
  rewriteHelm(manifest)
  say(`prepared ${manifest.release}`)
  say(path)
}

function printVersion(options) {
  const manifest = makeManifest(options.values)
  const path = writeManifest(manifest)
  say(JSON.stringify({ manifest: path, ...manifest }, null, 2))
}

function dryRun(options) {
  const manifest = makeManifest(options.values)
  if (options.flags.has('local')) {
    simulateWorkflow(manifest)
    return
  }
  const ref = options.values.ref ?? process.env.CARACAL_WORKFLOW_REF ?? currentBranch()
  const args = [
    'workflow',
    'run',
    'release.yml',
    '--ref',
    ref,
    '-f',
    `ref=${ref}`,
    '-f',
    `releaseVersion=${manifest.release}`,
    '-f',
    'dryRun=true',
  ]
  say(`rc release workflow dry-run: ${manifest.release}`)
  say(`queuing .github/workflows/release.yml on ${ref}`)
  say(`publishing: disabled by workflow_dispatch`)
  if (manifest.source.dirty) say(`warning: local working tree is dirty; GitHub Actions will run the remote ${ref}, not local uncommitted changes`)
  if (options.flags.has('print-command')) {
    say(`gh ${args.map(shellArg).join(' ')}`)
    return
  }
  const remote = remoteSha(ref)
  if (!remote) die(`origin does not have ref ${ref}; push a branch or choose an existing --ref`)
  if (!options.flags.has('allow-stale-ref') && ref === currentBranch() && remote !== headSha()) {
    die(`origin/${ref} does not match local HEAD; GitHub Actions would run the old remote workflow. Push ${ref}, choose another --ref, or pass --allow-stale-ref.`)
  }
  execFileSync('gh', args, { cwd: repoRoot, stdio: 'inherit' })
  say(`queued release.yml dry run for ${manifest.release}`)
  say(`monitor with: gh run list --workflow release.yml --limit 5`)
}

function shellArg(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

function simulateWorkflow(manifest) {
  const path = manifestPath(manifest)
  say(`rc release workflow dry-run: ${manifest.release}`)
  say(`workflow: .github/workflows/release.yml`)
  say(`trigger: simulated tag push ${manifest.release}`)
  say(`mode: ${manifest.mode}`)
  say(`publishing: disabled`)
  say()
  say(`release metadata`)
  say(`  would write ${path}`)
  say(`  would stamp Helm chart ${manifest.helm.chartVersion}`)
  say(`  would stamp Helm appVersion/image tag ${manifest.version}`)
  say(`  would stamp runtime and Console binaries ${manifest.version}`)
  say()
  say(`jobs`)
  say(`  check-maintainer`)
  say(`    would verify release actor against .github/MAINTAINERS`)
  say(`    would validate tag format for ${manifest.release}`)
  say(`    would validate ${path} with CARACAL_VALIDATE_HELM_FILES=1`)
  say(`  binaries`)
  say(`    would install pnpm 11.1.1, Node 24, and Bun 1.3.14`)
  say(`    would run pnpm install --frozen-lockfile --prefer-offline`)
  say(`    would run pnpm run build:typescript`)
  say(`    would build runtime and Console binaries for linux/darwin/windows amd64/arm64 targets`)
  say(`    would package release archives:`)
  for (const name of archiveTargets) say(`      ${name}-${manifest.release}.${name.includes('windows') ? 'zip' : 'tar.gz'}`)
  say(`    would generate SHA256SUMS, verify checksums, smoke-test linux-amd64 archives, and upload release-archives`)
  say(`    would request build provenance attestations for pushed-tag artifacts`)
  say(`  images`)
  for (const [name, context, dockerfile] of imageBuilds.filter(([name]) => name !== 'runtime')) {
    say(`    would build linux/amd64,linux/arm64 ${manifest.images[name]} from ${dockerfile} (context ${context})`)
  }
  say(`    would push immutable rc image tags only on the real tag workflow`)
  say(`  runtimeImage`)
  say(`    would build linux/amd64,linux/arm64 ${manifest.images.runtime} from apps/runtime/Dockerfile`)
  say(`    would push the immutable rc runtime image tag only on the real tag workflow`)
  say(`  publish`)
  say(`    would use environment rc-release`)
  say(`    would create GitHub Release ${manifest.release} with prerelease=true`)
  say(`    would attach release archives, manifest.json, SHA256SUMS, and installers`)
  say(`  validateRelease`)
  say(`    would run .github/workflows/postReleaseValidation.yml with release=${manifest.release}`)
  say(`  promoteImages`)
  say(`    skipped for rc; would not move latest or series tags`)
  say()
  say(JSON.stringify({ manifest: path, ...manifest }, null, 2))
}

function clean(options) {
  const manifest = loadManifest(options.values.manifest)
  rmSync(dirname(manifestPath(manifest)), { recursive: true, force: true })
  say(`cleaned ${manifest.release}`)
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  switch (options.command) {
    case 'version':
      printVersion(options)
      break
    case 'dry-run':
      dryRun(options)
      break
    case 'prepare':
      prepare(options)
      break
    case 'clean':
      clean(options)
      break
    case '-h':
    case '--help':
    case undefined:
      say(`Usage: scripts/rc.sh <command> [options]

Commands:
  dry-run                Queue release.yml through workflow_dispatch without publishing.
  version                 Generate an rc manifest under releases/<tag>/manifest.json.
  prepare [--allow-dirty] Generate the manifest and stamp package metadata to rc versions.
  clean --manifest PATH   Remove an rc manifest directory.

Options:
  --base-version VER      Base version; default UTC CalVer.
  --suffix VALUE          rc suffix; default rc.sha<gitsha>. Also supports rc.<number>.
  --ref REF               GitHub ref to run for dry-run; default current branch.
  --manifest PATH|TAG     rc manifest path or tag for clean.
  --npm-registry URL      npm registry endpoint; default https://registry.npmjs.org/.
  --pypi-index URL        Python simple index endpoint; default https://pypi.org/simple/.
  --oci-registry HOST     OCI registry namespace; default ghcr.io/garudex-labs.
  --github-release-base   GitHub Releases download base URL.
  --local                 Print the local workflow simulation instead of queuing Actions.
  --print-command         Print the gh workflow command without running it.
  --allow-stale-ref       Queue Actions even when the selected branch differs from local HEAD.`)
      break
    default:
      die(`unknown command: ${options.command}`)
  }
}

main()
