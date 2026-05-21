// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal doctor` reports local control-plane readiness for a protected resource.

import type { CliConfig } from '../config.ts'
import { DEFAULT_COORDINATOR_URL, DEFAULT_ZONE_URL, resolveServiceUrl } from '@caracalai/engine/cli'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  showHelp,
} from './shared.ts'

interface DoctorCheck {
  check: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

interface ServiceTarget {
  name: string
  baseUrl: string
  metricsPath?: string
  summarizeMetrics?: (value: unknown) => string
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function serviceUrl(envKeys: string[], devDefault: string): string {
  for (const key of envKeys) {
    const value = process.env[key]
    if (value) return value.replace(/\/$/, '')
  }
  return resolveServiceUrl(envKeys[0]!, devDefault).replace(/\/$/, '')
}

function nestedNumber(value: unknown, path: string[]): number | undefined {
  let current = value
  for (const part of path) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'number' ? current : undefined
}

function summarizeSTS(value: unknown): string {
  const compileErrors = nestedNumber(value, ['opa', 'compile_errors'])
  const evalErrors = nestedNumber(value, ['opa', 'eval_errors'])
  const maxPolicyAge = nestedNumber(value, ['opa', 'max_policy_age_seconds'])
  return `opa compile_errors=${compileErrors ?? '-'} eval_errors=${evalErrors ?? '-'} max_policy_age_seconds=${maxPolicyAge ?? '-'}`
}

function summarizeGateway(value: unknown): string {
  const bindings = nestedNumber(value, ['bindings_loaded'])
  const revocations = nestedNumber(value, ['revocations_active'])
  const denied = nestedNumber(value, ['requests_denied'])
  return `bindings=${bindings ?? '-'} revocations=${revocations ?? '-'} denied=${denied ?? '-'}`
}

function summarizeAudit(value: unknown): string {
  const lag = nestedNumber(value, ['consumer_lag'])
  const dlq = nestedNumber(value, ['dlq_size'])
  const tamper = nestedNumber(value, ['tamper_mismatch_total'])
  return `consumer_lag=${lag ?? '-'} dlq_size=${dlq ?? '-'} tamper_mismatch_total=${tamper ?? '-'}`
}

function summarizeCoordinator(value: unknown): string {
  const outboxDead = nestedNumber(value, ['outbox', 'dead'])
  const outboxPending = nestedNumber(value, ['outbox', 'pending'])
  const invocationsRunning = nestedNumber(value, ['invocations', 'running'])
  return `outbox_pending=${outboxPending ?? '-'} outbox_dead=${outboxDead ?? '-'} invocations_running=${invocationsRunning ?? '-'}`
}

async function runCheck(checks: DoctorCheck[], name: string, fn: () => Promise<string>): Promise<void> {
  try {
    checks.push({ check: name, status: 'ok', detail: await fn() })
  } catch (err) {
    checks.push({ check: name, status: 'fail', detail: message(err) })
  }
}

async function fetchOk(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return url
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

async function runExtendedChecks(checks: DoctorCheck[], targets: ServiceTarget[]): Promise<void> {
  for (const target of targets) {
    await runCheck(checks, `${target.name} readiness`, async () => fetchOk(`${target.baseUrl}/ready`))
    if (target.metricsPath) {
      await runCheck(checks, `${target.name} metrics`, async () => {
        const body = await fetchJSON(`${target.baseUrl}${target.metricsPath}`)
        return target.summarizeMetrics ? target.summarizeMetrics(body) : 'queryable'
      })
    }
  }
}

export async function doctorCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') return help()
  const { flags } = parseArgs(argv)
  const json = flagBool(flags, 'json')
  const extended = flagBool(flags, 'extended')
  const ready = flagBool(flags, 'ready')
  try {
    const ctx = buildAdminClient(cfg)
    const { client } = ctx
    const zoneId = flagString(flags, 'zone') ?? ctx.zoneId
    const checks: DoctorCheck[] = []

    await runCheck(checks, 'api health', async () => {
      return fetchOk(`${ctx.apiUrl.replace(/\/$/, '')}/health`)
    })
    await runCheck(checks, 'admin auth', async () => {
      const zones = await client.zones.list()
      return `${zones.length} zone(s) visible`
    })

    if (!zoneId) {
      checks.push({ check: 'zone', status: 'warn', detail: 'no zone selected; pass --zone or set CARACAL_ZONE_ID' })
    } else {
      await runCheck(checks, 'zone', async () => {
        const zone = await client.zones.get(zoneId)
        return `${zone.id} (${zone.name})`
      })
      await runCheck(checks, 'resources', async () => {
        const rows = await client.resources.list(zoneId)
        return rows.length === 0 ? 'none registered' : `${rows.length} registered`
      })
      await runCheck(checks, 'policy sets', async () => {
        const rows = await client.policySets.list(zoneId)
        const active = rows.filter((row) => row.active_version_id).length
        return active === 0 ? `${rows.length} registered; none active` : `${active} active`
      })
      await runCheck(checks, 'grants', async () => {
        const rows = await client.grants.list(zoneId)
        return rows.length === 0 ? 'none active' : `${rows.length} visible`
      })
      await runCheck(checks, 'audit query', async () => {
        await client.audit.list(zoneId, { limit: 1 })
        return 'queryable'
      })
    }

    if (extended) {
      const apiUrl = ctx.apiUrl.replace(/\/$/, '')
      await runExtendedChecks(checks, [
        { name: 'api', baseUrl: apiUrl },
        {
          name: 'sts',
          baseUrl: serviceUrl(['CARACAL_STS_URL', 'CARACAL_ZONE_URL'], DEFAULT_ZONE_URL),
          metricsPath: '/metrics.json',
          summarizeMetrics: summarizeSTS,
        },
        {
          name: 'gateway',
          baseUrl: serviceUrl(['CARACAL_GATEWAY_URL'], 'http://localhost:8081'),
          metricsPath: '/metrics.json',
          summarizeMetrics: summarizeGateway,
        },
        {
          name: 'audit',
          baseUrl: serviceUrl(['CARACAL_AUDIT_URL'], 'http://localhost:9090'),
          metricsPath: '/metrics.json',
          summarizeMetrics: summarizeAudit,
        },
        {
          name: 'coordinator',
          baseUrl: serviceUrl(['CARACAL_COORDINATOR_URL'], DEFAULT_COORDINATOR_URL),
          metricsPath: '/stats',
          summarizeMetrics: summarizeCoordinator,
        },
      ])
    }

    const allOk = checks.every((c) => c.status === 'ok')
    if (json) {
      printJSON(ready ? { ready: allOk, checks } : checks)
    } else {
      printTable(checks, ['check', 'status', 'detail'])
    }
    if (!allOk) process.exit(1)
    return
  } catch (err) {
    fail(err)
  }
}

function help(): never {
  return showHelp(
    [
      'Usage: caracal doctor [--zone <id>] [--extended] [--ready] [--json]',
      '',
      'Checks control-plane readiness. --extended also probes service readiness and operator metrics.',
      'Exit code is 0 only when every check is ok; otherwise 1. Use --ready in orchestrator gates.',
      '',
      'Flags:',
      '  --zone <id>             Zone selector (or CARACAL_ZONE_ID)',
      '  --extended              Probe API, STS, Gateway, Audit, and Coordinator readiness and metrics',
      '  --ready                 With --json, wrap output as { ready, checks } for machine consumers',
      '  --json                  Emit machine-readable output',
      '  --help, -h              Show this help',
      '',
    ],
  )
}
