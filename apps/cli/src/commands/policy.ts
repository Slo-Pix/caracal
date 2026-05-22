// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal policy …` and `caracal policy-set …` admin subcommands.

import type { CliConfig } from '../config.ts'
import { printSuccess } from '../style.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagList,
  flagString,
  parseArgs,
  printJSON,
  printTable,
  readContent,
  requireZone,
  showHelp,
  unknownVerb,
  usage,
} from './shared.ts'

export async function policyCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  if (verb === undefined || verb === 'help' || verb === '--help' || verb === '-h') {
    return policyHelp()
  }
  const { positional, flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')

  try {
    const ctx = buildAdminClient(cfg)
    const { client } = ctx
    switch (verb) {
      case 'list': {
        const zoneId = requireZone(ctx, flags)
        const rows = await client.policies.list(zoneId)
        if (json) return printJSON(rows)
        return printTable(rows, ['id', 'name', 'description', 'owner_type', 'created_by', 'created_at'])
      }
      case 'get': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('policy get <id> [--zone …]')
        return printJSON(await client.policies.get(zoneId, id))
      }
      case 'create': {
        const zoneId = requireZone(ctx, flags)
        const name = flagString(flags, 'name')
        const file = flagString(flags, 'file')
        const inline = flagString(flags, 'content')
        if (!name || (!file && !inline)) {
          return usage('policy create --name <n> --file <path>|--content <rego> [--description …] [--owner-type …]')
        }
        const content = readContent(file ? `@${file}` : inline)
        return printJSON(await client.policies.create(zoneId, {
          name,
          content,
          description: flagString(flags, 'description'),
          owner_type: flagString(flags, 'owner-type'),
        }))
      }
      case 'validate': {
        const file = flagString(flags, 'file')
        const inline = flagString(flags, 'content')
        if (!file && !inline) return usage('policy validate --file <path>|--content <rego> [--schema-version …]')
        const content = readContent(file ? `@${file}` : inline)
        return printJSON(await client.policies.validate(content, flagString(flags, 'schema-version')))
      }
      case 'version': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        const file = flagString(flags, 'file')
        const inline = flagString(flags, 'content')
        if (!id || (!file && !inline)) {
          return usage('policy version <id> --file <path>|--content <rego>')
        }
        const content = readContent(file ? `@${file}` : inline)
        return printJSON(await client.policies.addVersion(zoneId, id, content, flagString(flags, 'schema-version')))
      }
      case 'delete': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('policy delete <id> [--zone …]')
        await client.policies.delete(zoneId, id)
        printSuccess(`archived ${id}`)
        return
      }
      default:
        return unknownVerb('policy', verb, policyHelp)
    }
  } catch (err) {
    fail(err)
  }
}

export async function policySetCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  if (verb === undefined || verb === 'help' || verb === '--help' || verb === '-h') {
    return policySetHelp()
  }
  const ctx = buildAdminClient(cfg)
  const { client } = ctx
  const { positional, flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')

  try {
    switch (verb) {
      case 'list': {
        const zoneId = requireZone(ctx, flags)
        const rows = await client.policySets.list(zoneId)
        if (json) return printJSON(rows)
        return printTable(rows, ['id', 'name', 'active_version_id', 'description', 'created_at'])
      }
      case 'get': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('policy-set get <id> [--zone …]')
        return printJSON(await client.policySets.get(zoneId, id))
      }
      case 'create': {
        const zoneId = requireZone(ctx, flags)
        const name = flagString(flags, 'name')
        if (!name) return usage('policy-set create --name <n> [--description …]')
        return printJSON(await client.policySets.create(zoneId, name, flagString(flags, 'description')))
      }
      case 'version': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        const versions = flagList(flags, 'policy-versions')
        if (!id || !versions || versions.length === 0) {
          return usage('policy-set version <id> --policy-versions vid1,vid2,…')
        }
        const manifest = versions.map((policy_version_id) => ({ policy_version_id }))
        return printJSON(await client.policySets.addVersion(zoneId, id, manifest))
      }
      case 'activate': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        const versionId = flagString(flags, 'version')
        if (!id || !versionId) {
          return usage('policy-set activate <id> --version <version-id> [--shadow <version-id>]')
        }
        return printJSON(await client.policySets.activate(zoneId, id, versionId, flagString(flags, 'shadow')))
      }
      case 'simulate': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        const versionId = flagString(flags, 'version')
        const inputValue = flagString(flags, 'input') ?? (flagString(flags, 'input-file') ? `@${flagString(flags, 'input-file')}` : undefined)
        if (!id || !versionId) {
          return usage('policy-set simulate <id> --version <version-id> [--input <json>|--input-file <path>]')
        }
        const input = inputValue ? JSON.parse(readContent(inputValue)) as Record<string, unknown> : undefined
        return printJSON(await client.policySets.simulate(zoneId, id, versionId, input))
      }
      case 'delete': {
        const zoneId = requireZone(ctx, flags)
        const id = positional[0]
        if (!id) return usage('policy-set delete <id> [--zone …]')
        await client.policySets.delete(zoneId, id)
        printSuccess(`archived ${id}`)
        return
      }
      default:
        return unknownVerb('policy-set', verb, policySetHelp)
    }
  } catch (err) {
    fail(err)
  }
}

function policyHelp(): never {
  return showHelp(
    [
      'Usage: caracal policy <verb> [options]',
      '',
      'Verbs:',
      '  list                       List policies in a zone',
      '  get <id>                   Fetch a policy and its versions as JSON',
      '  create                     Create a policy with an initial Rego version',
      '    --name <n>                 Policy name (required)',
      '    --file <path>              Path to Rego file (required if --content omitted)',
      '    --content <rego>           Inline Rego content (required if --file omitted)',
      '    --description <d>          Optional description',
      '    --owner-type <t>           Owner type',
      '  validate                   Validate a Rego policy against the STS contract',
      '    --file <path>|--content <rego>  Policy content (required)',
      '    --schema-version <v>       Policy schema version (default: current)',
      '  version <id>               Add a new Rego version to an existing policy',
      '    --file <path>|--content <rego>  New Rego content (required)',
      '    --schema-version <v>       Policy schema version (default: 2026-05-20)',
      '  delete <id>                Archive a policy (soft-delete)',
      '',
      'Flags:',
      '  --zone <id>                Zone selector (or CARACAL_ZONE_ID)',
      '  --json                     Emit raw JSON',
      '  --help, -h                 Show this help',
      '',
    ],
  )
}

function policySetHelp(): never {
  return showHelp(
    [
      'Usage: caracal policy-set <verb> [options]',
      '',
      'Verbs:',
      '  list                       List policy-sets in a zone',
      '  get <id>                   Fetch a policy-set by ID as JSON',
      '  create                     Create a policy-set',
      '    --name <n>                 Policy-set name (required)',
      '    --description <d>          Optional description',
      '  version <id>               Bundle policy versions into a new set version',
      '    --policy-versions v1,v2    Comma-separated policy version IDs (required)',
      '  activate <id>              Promote a version to active',
      '    --version <vid>            Policy-set version ID to activate (required)',
      '    --shadow <vid>             Optional shadow version for gradual rollout',
      '  simulate <id>              Validate rollout contract and optional policy input without activation',
      '    --version <vid>            Policy-set version ID to simulate (required)',
      '    --input <json>             Inline OPA input fixture',
      '    --input-file <path>        OPA input fixture file',
      '  delete <id>                Archive a policy-set (soft-delete)',
      '',
      'Flags:',
      '  --zone <id>                Zone selector (or CARACAL_ZONE_ID)',
      '  --json                     Emit raw JSON',
      '  --help, -h                 Show this help',
      '',
    ],
  )
}
