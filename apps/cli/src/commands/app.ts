// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal app …` admin subcommands.

import {
  appList,
  appGet,
  appCreate,
  appPatch,
  appDelete,
  appDcr,
} from '@caracalai/cli-core'
import type { CredentialType, RegistrationMethod } from '@caracalai/admin'
import type { CliConfig } from '../config.ts'
import { printSuccess } from '../style.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagInt,
  flagList,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  requireZone,
  showHelp,
  unknownVerb,
  usage,
} from './shared.ts'

export async function appCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  const ctx = buildAdminClient(cfg)
  const { client } = ctx
  const { positional, flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')

  try {
    switch (verb) {
      case 'list': {
        const zoneId = requireZone(ctx, flags)
        const rows = await appList({ client, zoneId })
        if (json) return printJSON(rows)
        return printTable(rows, ['id', 'name', 'registration_method', 'credential_type', 'consent', 'created_at'])
      }
      case 'get': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('app get <id> [--zone …]')
        return printJSON(await appGet({ client, zoneId, id }))
      }
      case 'create': {
        const zoneId = requireZone(ctx, flags)
        const name = flagString(flags, 'name')
        if (!name) return usage('app create --name <n> [--method managed|dcr] [--credential-type …] [--client-secret …] [--traits a,b] [--consent]')
        return printJSON(await appCreate({
          client,
          zoneId,
          input: {
            name,
            registration_method: (flagString(flags, 'method') as RegistrationMethod | undefined) ?? 'managed',
            credential_type: flagString(flags, 'credential-type') as CredentialType | undefined,
            client_secret: flagString(flags, 'client-secret'),
            traits: flagList(flags, 'traits'),
            consent: flagBool(flags, 'consent') || undefined,
          },
        }))
      }
      case 'patch': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('app patch <id> [--name …] [--credential-type …] [--client-secret …] [--traits …]')
        return printJSON(await appPatch({
          client,
          zoneId,
          id,
          input: {
            name: flagString(flags, 'name'),
            credential_type: flagString(flags, 'credential-type') as CredentialType | undefined,
            client_secret: flagString(flags, 'client-secret'),
            traits: flagList(flags, 'traits'),
            consent: flags['consent'] === undefined ? undefined : flagBool(flags, 'consent'),
          },
        }))
      }
      case 'delete': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('app delete <id> [--zone …]')
        await appDelete({ client, zoneId, id })
        printSuccess(`deleted ${id}`)
        return
      }
      case 'dcr': {
        const zoneId = requireZone(ctx, flags)
        const name = flagString(flags, 'name')
        if (!name) return usage('app dcr --name <n> [--credential-type …] [--client-secret …] [--traits …] [--expires-in <s>]')
        return printJSON(await appDcr({
          client,
          zoneId,
          input: {
            name,
            credential_type: flagString(flags, 'credential-type') as CredentialType | undefined,
            client_secret: flagString(flags, 'client-secret'),
            traits: flagList(flags, 'traits'),
            expires_in: flagInt(flags, 'expires-in'),
          },
        }))
      }
      case 'help':
      case '--help':
      case '-h':
        return help()
      default:
        return unknownVerb('app', verb, help)
    }
  } catch (err) {
    fail(err)
  }
}

function help(): never {
  return showHelp(
    [
      'Usage: caracal app <verb> [options]',
      '',
      'Verbs:',
      '  list                    List applications in a zone',
      '  get <id>                Fetch an application by ID as JSON',
      '  create                  Register a new application',
      '    --name <n>              Application name (required)',
      '    --method managed|dcr    Registration method (default: managed)',
      '    --credential-type <t>   token | password | public-key | url | public',
      '    --client-secret <s>     Pre-set a client secret',
      '    --traits a,b            Comma-separated trait list',
      '    --consent               Enable consent requirement',
      '  patch <id>              Update an application',
      '    --name, --credential-type, --client-secret, --traits, --consent=true|false',
      '  delete <id>             Permanently delete an application',
      '  dcr                     Dynamic client registration (DCR)',
      '    --name <n>              Application name (required)',
      '    --credential-type <t>   Credential type',
      '    --client-secret <s>     Client secret',
      '    --traits a,b            Trait list',
      '    --expires-in <s>        Token TTL in seconds',
      '',
      'Flags:',
      '  --zone <id>             Zone selector (or CARACAL_ZONE_ID)',
      '  --json                  Emit raw JSON',
      '  --help, -h              Show this help',
      '',
    ],
  )
}
