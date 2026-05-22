// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal-cli control …` admin subcommands for managing control API credentials.

import {
  controlKeyCreate,
  controlKeyGet,
  controlKeyList,
  controlKeyRevoke,
  controlKeyRotate,
  type ControlAction,
} from '@caracalai/engine'
import type { CliConfig } from '../config.ts'
import { printError, printSuccess } from '../style.ts'
import { controlToggleCommand } from './controlToggle.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  requireZone,
  showHelp,
  unknownVerb,
  usage,
} from './shared.ts'

export async function controlCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, sub, ...rest] = argv
  if (verb === 'mount' || verb === 'enable' || verb === 'disable' || verb === 'unmount' || verb === 'status') {
    return controlToggleCommand(argv, cfg)
  }
  const ctx = buildAdminClient(cfg)
  const { client } = ctx
  const { positional, flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')

  try {
    switch (verb) {
      case 'key': {
        switch (sub) {
          case 'list': {
            const zoneId = requireZone(ctx, flags)
            const rows = await controlKeyList(client, zoneId)
            if (json) return printJSON(rows)
            return printTable(rows, ['client_id', 'name', 'credential_type', 'traits', 'created_at'])
          }
          case 'get': {
            const zoneId = requireZone(ctx, flags)
            const id = positional[0]
            if (!id) return usage('control key get <id> [--zone …]')
            return printJSON(await controlKeyGet(client, zoneId, id))
          }
          case 'create': {
            const zoneId = requireZone(ctx, flags)
            const name = flagString(flags, 'name')
            if (!name) return usage('control key create --name <n> (--scope <scope> | --action <read,write,delete> [--resource <command>]) [--zone …]')
            if ('client-secret' in flags) throw new Error('control key client_secret is generated automatically; --client-secret is not supported')
            const result = await controlKeyCreate(client, zoneId, {
              name,
              audience: flagString(flags, 'audience'),
              scopes: splitList(flagString(flags, 'scope') ?? flagString(flags, 'capability')),
              actions: controlActions(flagString(flags, 'action')),
              resources: splitList(flagString(flags, 'resource')),
              maxTtlSeconds: intFlag(flagString(flags, 'max-ttl')),
              expiresAt: expiry(flagString(flags, 'expires-at'), flagString(flags, 'expires-in')),
            })
            printJSON({
              name: result.application.name,
              client_id: result.application.id,
              client_secret: result.clientSecret,
              resource: result.resource.identifier,
              allowed_scopes: result.allowedScopes,
              max_ttl_seconds: result.maxTtlSeconds,
              expires_at: result.expiresAt,
              restrictions: ['zone-bound', 'application-only', 'no-subject-token', 'no-delegation'],
              traits: result.application.traits,
              note: 'store client_secret now — it cannot be retrieved later',
            })
            return
          }
          case 'help':
          case '--help':
          case '-h':
          case undefined:
            return help()
          default:
            return unknownVerb('control key', sub, help)
        }
      }
      case 'rotate': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0] ?? (typeof sub === 'string' && !sub.startsWith('--') ? sub : undefined)
        if (!id) return usage('control rotate <id> [--zone …]')
        const result = await controlKeyRotate(client, zoneId, id)
        printJSON({
          client_id: result.application.id,
          client_secret: result.clientSecret,
          note: 'store client_secret now — it cannot be retrieved later',
        })
        return
      }
      case 'revoke': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0] ?? (typeof sub === 'string' && !sub.startsWith('--') ? sub : undefined)
        if (!id) return usage('control revoke <id> [--zone …]')
        await controlKeyRevoke(client, zoneId, id)
        printSuccess(`revoked control key ${id}`)
        return
      }
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        return help()
      default:
        return unknownVerb('control', verb, help)
    }
  } catch (err) {
    fail(err)
  }
}

function help(): never {
  return showHelp(
    [
      'Usage: caracal-cli control <verb> [...]',
      '',
      'Verbs:',
      '  mount                      Prepare Control without exposing the endpoint',
      '  enable                     Start the mounted endpoint for authenticated automation',
      '  disable                    Stop the endpoint but keep runtime for fast re-enable',
      '  unmount                    Remove the Control runtime for long-term idle state',
      '  status                     Show Control enablement, endpoint, and lifecycle status',
      '  key list                   List control API credentials in a zone',
      '  key get <id>               Show one control API credential',
      '  key create --name <n>      Mint a scoped control API credential',
      '    --audience <aud>           Control token audience resource (default caracal-control)',
      '    --scope <scope,...>        Exact Control scopes for least privilege',
      '    --capability <scope,...>   Alias for --scope',
      '    --action <read,...>        Grant all scopes matching actions: read, write, delete',
      '    --resource <cmd,...>       Limit --action grants to command resources such as zone, app, audit',
      '    --max-ttl <seconds>        Maximum token TTL for this key, 60-900 seconds',
      '    --expires-at <iso>         Disable key after an ISO timestamp',
      '    --expires-in <seconds>     Disable key after a relative duration',
      '  rotate <id>                Rotate the client secret for a control API credential',
      '  revoke <id>                Delete a control API credential (invalidates it immediately)',
      '',
      'Flags:',
      '  --zone <id>                Zone selector (or CARACAL_ZONE_ID)',
      '  --json                     Emit raw JSON',
      '  --help, -h                 Show this help',
      '',
    ],
  )
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const list = value.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
  return list.length > 0 ? list : undefined
}

function controlActions(value: string | undefined): ControlAction[] | undefined {
  const values = splitList(value)
  if (!values) return undefined
  for (const action of values) {
    if (action !== 'read' && action !== 'write' && action !== 'delete') {
      throw new Error(`unsupported control action: ${action}`)
    }
  }
  return values as ControlAction[]
}

function intFlag(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) throw new Error(`invalid integer: ${value}`)
  return parsed
}

function expiry(expiresAt: string | undefined, expiresIn: string | undefined): string | undefined {
  if (expiresAt && expiresIn) throw new Error('use either --expires-at or --expires-in, not both')
  if (expiresAt) return expiresAt
  const seconds = intFlag(expiresIn)
  if (!seconds) return undefined
  if (seconds <= 0) throw new Error('--expires-in must be positive')
  return new Date(Date.now() + seconds * 1000).toISOString()
}
