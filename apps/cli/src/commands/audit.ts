// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal audit …` and `caracal explain <request_id>` debuggability commands.

import type { CliConfig } from '../config.ts'
import { printError } from '../style.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagInt,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  requireZone,
  showHelp,
  unknownVerb,
} from './shared.ts'

export async function auditCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  const ctx = buildAdminClient(cfg)
  const { client } = ctx
  const { flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')

  try {
    switch (verb) {
      case 'tail': {
        const zoneId = requireZone(ctx, flags)
        const rows = await client.audit.list(zoneId, {
          since: flagString(flags, 'since'),
          until: flagString(flags, 'until'),
          request_id: flagString(flags, 'request-id'),
          decision: flagString(flags, 'decision') as 'allow' | 'deny' | 'partial' | undefined,
          event_type: flagString(flags, 'event-type'),
          limit: flagInt(flags, 'limit'),
        })
        if (json) return printJSON(rows)
        return printTable(rows, ['occurred_at', 'event_type', 'decision', 'evaluation_status', 'request_id', 'id'])
      }
      case 'help':
      case '--help':
      case '-h':
        return auditHelp()
      default:
        return unknownVerb('audit', verb, auditHelp)
    }
  } catch (err) {
    fail(err)
  }
}

function auditHelp(): never {
  return showHelp(
    [
      'Usage: caracal audit tail [options]',
      '',
      'Fetch recent audit events for a zone. Add --limit and --since to page results.',
      '',
      'Flags:',
      '  --zone <id>                Zone selector (or CARACAL_ZONE_ID)',
      '  --since <iso8601>          Return events at or after this timestamp (inclusive, e.g. 2026-05-21T14:00:00Z)',
      '  --until <iso8601>          Return events strictly before this timestamp (exclusive)',
      '  --request-id <id>          Filter by request ID',
      '  --decision allow|deny|partial  Filter by policy decision',
      '  --event-type <type>        Filter by event type',
      '  --limit N                  Maximum number of rows (default: 100, max: 1000). For pagination, page with --until set to the oldest occurred_at of the previous page.',
      '  --json                     Emit raw JSON',
      '  --help, -h                 Show this help',
      '',
      'See also: caracal explain <request_id>  — show full diagnostics for one request',
      '',
    ],
  )
}

export async function explainCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const ctx = buildAdminClient(cfg)
  const { client } = ctx
  const { positional, flags } = parseArgs(argv)
  const requestId = positional[0]
  if (!requestId) {
    printError('Usage: caracal explain <request_id> [--zone …] [--json]')
    process.exit(1)
  }
  const zoneId = requireZone(ctx, flags)
  const json = flagBool(flags, 'json')

  try {
    const rows = await client.audit.byRequest(zoneId, requestId)
    if (json) return printJSON(rows)
    for (const row of rows) {
      process.stdout.write(`event       ${row.event_type}  decision=${row.decision ?? '-'}  status=${row.evaluation_status ?? '-'}\n`)
      process.stdout.write(`occurred_at ${row.occurred_at}\n`)
      process.stdout.write(`request_id  ${row.request_id ?? '-'}\n`)
      process.stdout.write(`policy_set  ${row.policy_set_id ?? '-'} version=${row.policy_set_version_id ?? '-'} sha=${row.manifest_sha ?? '-'}\n`)
      const authority = authorityLines(row.metadata_json)
      if (authority.length > 0) {
        process.stdout.write('authority:\n')
        process.stdout.write(authority.join('\n') + '\n')
      }
      if (row.determining_policies_json && row.determining_policies_json.length > 0) {
        process.stdout.write('determining_policies:\n')
        process.stdout.write(JSON.stringify(row.determining_policies_json, null, 2) + '\n')
      }
      if (row.diagnostics_json && row.diagnostics_json.length > 0) {
        process.stdout.write('diagnostics:\n')
        process.stdout.write(JSON.stringify(row.diagnostics_json, null, 2) + '\n')
      }
      if (row.metadata_json) {
        process.stdout.write('metadata:\n')
        process.stdout.write(JSON.stringify(row.metadata_json, null, 2) + '\n')
      }
      process.stdout.write('\n')
    }
  } catch (err) {
    fail(err)
  }
}

function authorityLines(meta: Record<string, unknown> | null): string[] {
  if (!meta) return []
  const application = stringField(meta, 'application_id') ?? stringField(meta, 'client_id')
  const authoritySession = stringField(meta, 'root_sid') ?? stringField(meta, 'session_id') ?? stringField(meta, 'sid')
  const agentRun = stringField(meta, 'agent_session_id')
  const delegatedPermission = stringField(meta, 'delegation_edge_id')
  const resource = stringField(meta, 'resource')
  const scopes = stringList(meta, 'requested_scopes') ?? stringList(meta, 'scopes')
  const authMode = stringField(meta, 'auth_mode')
  const provider = stringField(meta, 'provider_id')
  const grant = stringField(meta, 'grant_id')
  const chain = delegationChain(meta)
  if (![application, authoritySession, agentRun, delegatedPermission, resource, scopes?.join(' '), authMode, provider, grant, chain].some(Boolean)) {
    return []
  }
  const lines = [
    `  application            ${application ?? '-'}`,
    `  authority_session      ${authoritySession ?? '-'}`,
    `  agent_run              ${agentRun ?? '-'}`,
    `  delegated_permission   ${delegatedPermission ?? '-'}`,
    `  resource               ${resource ?? '-'}`,
    `  scopes                 ${scopes?.join(' ') ?? '-'}`,
  ]
  if (authMode || provider || grant) {
    lines.push(`  provider               ${provider ?? '-'} grant=${grant ?? '-'} auth=${authMode ?? '-'}`)
  }
  if (chain) {
    lines.push(`  chain                  ${chain}`)
  }
  return lines
}

function stringField(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function stringList(meta: Record<string, unknown>, key: string): string[] | undefined {
  const value = meta[key]
  if (Array.isArray(value)) {
    const out = value.filter((item): item is string => typeof item === 'string' && item !== '')
    return out.length > 0 ? out : undefined
  }
  if (typeof value === 'string' && value !== '') return value.split(/\s+/).filter(Boolean)
  return undefined
}

function delegationChain(meta: Record<string, unknown>): string | undefined {
  const raw = meta.delegation_chain
  if (!Array.isArray(raw)) return undefined
  const parts = raw.flatMap((hop) => {
    if (!hop || typeof hop !== 'object') return []
    const item = hop as Record<string, unknown>
    const app = stringField(item, 'application_id')
    const agent = stringField(item, 'agent_session_id')
    if (!app && !agent) return []
    return [`${app ?? '-'}:${agent ?? '-'}`]
  })
  return parts.length > 0 ? parts.join(' -> ') : undefined
}
