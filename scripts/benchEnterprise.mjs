/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Portable HTTP load harness for Caracal enterprise capacity checks.
 */

import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

const args = parseArgs(process.argv.slice(2))

if (args.help || !args.url) {
  printHelp()
  process.exit(args.help ? 0 : 1)
}

const durationMs = intArg(args.duration, 30) * 1000
const warmupMs = intArg(args.warmup, 5) * 1000
const concurrency = intArg(args.concurrency, 16)
const timeoutMs = intArg(args.timeout, 5000)
const method = (args.method ?? 'GET').toUpperCase()
const headers = args.headersFile ? JSON.parse(await readFile(args.headersFile, 'utf8')) : {}
const body = args.bodyFile ? await readFile(args.bodyFile) : undefined
const started = performance.now()
const sampleAfter = started + warmupMs
const stopAt = sampleAfter + durationMs
const latencies = []
const statuses = new Map()
let requests = 0
let failures = 0

await Promise.all(Array.from({ length: concurrency }, worker))

const elapsedSeconds = Math.max((performance.now() - sampleAfter) / 1000, 0.001)
latencies.sort((a, b) => a - b)
const report = {
  url: args.url,
  method,
  concurrency,
  duration_seconds: durationMs / 1000,
  warmup_seconds: warmupMs / 1000,
  requests,
  failures,
  requests_per_second: Number((requests / elapsedSeconds).toFixed(2)),
  latency_ms: {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.length ? Number(latencies.at(-1).toFixed(2)) : 0,
  },
  statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a.localeCompare(b))),
}

if (args.json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`url=${report.url} method=${report.method} concurrency=${report.concurrency}`)
  console.log(`requests=${report.requests} failures=${report.failures} rps=${report.requests_per_second}`)
  console.log(`latency_ms p50=${report.latency_ms.p50} p95=${report.latency_ms.p95} p99=${report.latency_ms.p99} max=${report.latency_ms.max}`)
  console.log(`statuses=${JSON.stringify(report.statuses)}`)
}

async function worker() {
  while (performance.now() < stopAt) {
    const sampled = performance.now() >= sampleAfter
    const t0 = performance.now()
    try {
      const response = await fetch(args.url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      await response.arrayBuffer()
      if (sampled) {
        requests += 1
        const key = String(response.status)
        statuses.set(key, (statuses.get(key) ?? 0) + 1)
        latencies.push(performance.now() - t0)
      }
    } catch {
      if (sampled) {
        requests += 1
        failures += 1
      }
    }
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const index = Math.min(values.length - 1, Math.ceil((p / 100) * values.length) - 1)
  return Number(values[index].toFixed(2))
}

function intArg(value, fallback) {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`invalid integer: ${value}`)
  return parsed
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
      continue
    }
    if (arg === '--json') {
      parsed.json = true
      continue
    }
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`)
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`)
    parsed[key] = value
    i += 1
  }
  return parsed
}

function printHelp() {
  console.log(`Usage: node scripts/benchEnterprise.mjs --url <url> [options]

Options:
  --method <method>          HTTP method, default GET
  --headers-file <path>      JSON object of headers
  --body-file <path>         Request body file
  --duration <seconds>       Sample duration, default 30
  --warmup <seconds>         Warmup duration, default 5
  --concurrency <n>          Concurrent workers, default 16
  --timeout <ms>             Per-request timeout, default 5000
  --json                     Emit JSON report
  --help                     Show this help
`)
}
