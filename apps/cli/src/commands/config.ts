// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal config ...` creates and manages local runtime configuration files.

import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  DEFAULT_ZONE_URL,
  defaultCliConfigPath,
  resolveServiceUrl,
} from '@caracalai/engine/cli'
import { generateClientSecret } from '@caracalai/engine'
import type { Application, Zone } from '@caracalai/admin'
import type { CliConfig } from '../config.ts'
import { printInfo, printSuccess } from '../style.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  showHelp,
  unknownVerb,
} from './shared.ts'

interface InitResult {
  path: string
  zone: Zone | { id: string }
  application: Application
  resource?: string
  credential_env?: string
}

export async function configCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  try {
    switch (verb) {
      case 'init':
        return initConfig(rest, cfg)
      case 'help':
      case '--help':
      case '-h':
        return help()
      default:
        return unknownVerb('config', verb, help)
    }
  } catch (err) {
    fail(err)
  }
}

async function initConfig(argv: string[], cfg?: CliConfig): Promise<void> {
  const { flags } = parseArgs(argv)
  const path = resolve(flagString(flags, 'path') ?? process.env.CARACAL_CONFIG ?? defaultCliConfigPath())
  const force = flagBool(flags, 'force')
  const json = flagBool(flags, 'json')
  if (existsSync(path) && !force) {
    throw new Error(`${path} already exists; pass --force to replace it or --path to write another file`)
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })

  const ctx = buildAdminClient(cfg)
  const zoneId = flagString(flags, 'zone') ?? ctx.zoneId
  const zone = zoneId
    ? { id: zoneId }
    : await ctx.client.zones.create({
        name: flagString(flags, 'zone-name') ?? 'dev',
        slug: flagString(flags, 'zone-slug'),
      })
  const clientSecret = flagString(flags, 'client-secret') ?? generateClientSecret()
  const application = await ctx.client.applications.create(zone.id, {
    name: flagString(flags, 'app-name') ?? 'runner',
    registration_method: 'managed',
    credential_type: 'token',
    client_secret: clientSecret,
  })
  const resource = flagString(flags, 'resource')
  const credentialEnv = resource ? flagString(flags, 'env') ?? 'RESOURCE_TOKEN' : undefined
  const runtimeConfig: CliConfig = {
    zone_url: resolveZoneUrl(),
    zone_id: zone.id,
    application_id: application.id,
    app_client_secret: clientSecret,
  }
  if (resource && credentialEnv) runtimeConfig.credentials = [{ env: credentialEnv, resource }]
  writeFileSync(path, renderConfig(runtimeConfig), { mode: 0o600 })
  chmodSync(path, 0o600)

  const result: InitResult = { path, zone, application }
  if (resource) result.resource = resource
  if (credentialEnv) result.credential_env = credentialEnv
  if (json) {
    printJSON(result)
    return
  }
  printSuccess(`wrote ${path}`)
  printInfo(`zone → ${zone.id}`)
  printInfo(`application → ${application.id}`)
  if (resource && credentialEnv) printInfo(`credential → ${credentialEnv} for ${resource}`)
}

function resolveZoneUrl(): string {
  const explicit = process.env.CARACAL_STS_URL ?? process.env.CARACAL_ZONE_URL
  if (explicit) return explicit
  return resolveServiceUrl('CARACAL_STS_URL', DEFAULT_ZONE_URL)
}

function renderConfig(cfg: CliConfig): string {
  const lines = [
    `zone_url = ${quoteToml(cfg.zone_url)}`,
    `zone_id = ${quoteToml(cfg.zone_id)}`,
    `application_id = ${quoteToml(cfg.application_id)}`,
    `app_client_secret = ${quoteToml(cfg.app_client_secret)}`,
  ]
  if (cfg.credentials?.length) {
    for (const credential of cfg.credentials) {
      lines.push('', '[[credentials]]', `env = ${quoteToml(credential.env)}`, `resource = ${quoteToml(credential.resource)}`)
    }
  }
  return `${lines.join('\n')}\n`
}

function quoteToml(value: string): string {
  return JSON.stringify(value)
}

function help(): never {
  return showHelp([
    'Usage: caracal config <verb> [options]',
    '',
    'Verbs:',
    '  init                    Create a confidential app and write caracal.toml',
    '    --zone <id>             Use an existing zone instead of creating one (or CARACAL_ZONE_ID)',
    '    --zone-name <n>         Zone name when creating a zone (default: dev)',
    '    --zone-slug <s>         Zone slug when creating a zone',
    '    --app-name <n>          Application name (default: runner)',
    '    --client-secret <s>     Use a supplied app secret instead of generating one',
    '    --resource <id>         Add one RESOURCE_TOKEN credential entry',
    '    --env <NAME>            Env var for --resource (default: RESOURCE_TOKEN)',
    '    --path <file>           Write to a specific path (or CARACAL_CONFIG)',
    '    --force                 Replace an existing config file',
    '    --json                  Emit structured output',
    '',
    'Defaults:',
    `  config path              ${defaultCliConfigPath()}`,
    '',
  ])
}
