// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal protect …` provisions the local Gateway-first golden path.

import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import type { AdminClient, Application, Grant, Policy, PolicyVersion, Resource, Zone } from '@caracalai/admin'
import { DEFAULT_ZONE_URL, resolveServiceUrl } from '@caracalai/engine/cli'
import type { CliConfig } from '../config.ts'
import { printInfo, printStep, printSuccess } from '../style.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagList,
  flagString,
  parseArgs,
  printJSON,
  showHelp,
  usage,
} from './shared.ts'

const POLICY_NAME = 'Local Gateway Scope Policy'
const POLICY_SET_NAME = 'Local Gateway Policies'
const DEFAULT_ZONE_NAME = 'Local Development'

interface ProtectResult {
  zone: Zone
  application: Application
  app_client_secret: string
  resource: Resource
  policy: Policy
  policy_version: PolicyVersion
  policy_set: { id: string; active_version_id?: string | null }
  grant: Grant
  config: string
  config_path?: string
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local'
}

function clientSecret(): string {
  return `cs_${randomBytes(32).toString('base64url')}`
}

function resolveZoneUrl(flags: Record<string, string | boolean>, cfg: CliConfig | undefined): string {
  return flagString(flags, 'zone-url') ?? cfg?.zone_url ?? resolveServiceUrl('CARACAL_STS_URL', DEFAULT_ZONE_URL)
}

function policyContent(): string {
  return `package caracal.authz

import rego.v1

default allow := false
default result := {"decision": "deny", "evaluation_status": "complete", "determining_policies": [], "diagnostics": []}

result := {"decision": "allow", "evaluation_status": "complete", "determining_policies": [{"policy": "local-gateway-scope"}], "diagnostics": []} if {
  allow
}

allow if {
  every scope in input.context.requested_scopes {
    scope in input.resource.scopes
  }
}
`
}

async function ensureZone(client: AdminClient, zoneId: string | undefined, zoneName: string): Promise<Zone> {
  if (zoneId) return client.zones.get(zoneId)
  const zones = await client.zones.list()
  const slug = slugify(zoneName)
  const existing = zones.find((zone) => zone.name === zoneName || zone.slug === slug)
  if (existing) return existing
  return client.zones.create({ name: zoneName, slug })
}

async function ensureApplication(client: AdminClient, zoneId: string, name: string, secret: string): Promise<Application> {
  const apps = await client.applications.list(zoneId)
  const existing = apps.find((app) => app.name === name)
  if (existing) {
    return client.applications.patch(zoneId, existing.id, {
      client_secret: secret,
      credential_type: 'token',
      traits: [...new Set([...(existing.traits ?? []), 'gateway'])],
      consent: false,
    })
  }
  return client.applications.create(zoneId, {
    name,
    registration_method: 'managed',
    credential_type: 'token',
    client_secret: secret,
    traits: ['gateway'],
    consent: false,
  })
}

function sameScopes(left: string[], right: string[]): boolean {
  const a = [...left].sort()
  const b = [...right].sort()
  return a.length === b.length && a.every((scope, index) => scope === b[index])
}

async function ensureResource(
  client: AdminClient,
  zoneId: string,
  identifier: string,
  scopes: string[],
  upstreamUrl: string,
  applicationId: string,
  name: string,
): Promise<Resource> {
  const resources = await client.resources.list(zoneId)
  const existing = resources.find((resource) => resource.identifier === identifier)
  if (!existing) {
    return client.resources.create(zoneId, {
      identifier,
      name,
      scopes,
      upstream_url: upstreamUrl,
      gateway_application_id: applicationId,
    })
  }
  if (
    existing.name === name &&
    existing.upstream_url === upstreamUrl &&
    existing.gateway_application_id === applicationId &&
    sameScopes(existing.scopes, scopes)
  ) {
    return existing
  }
  return client.resources.patch(zoneId, existing.id, {
    name,
    scopes,
    upstream_url: upstreamUrl,
    gateway_application_id: applicationId,
  })
}

async function ensurePolicy(client: AdminClient, zoneId: string, name: string): Promise<Policy & { version: PolicyVersion }> {
  const policies = await client.policies.list(zoneId)
  const existing = policies.find((policy) => policy.name === name)
  if (!existing) {
    return client.policies.create(zoneId, {
      name,
      description: 'Allows requested scopes that are registered on the target resource.',
      content: policyContent(),
      schema_version: '2026-05-20',
    })
  }
  const policy = await client.policies.get(zoneId, existing.id)
  const version = policy.versions[0]
  if (!version) {
    const created = await client.policies.addVersion(zoneId, existing.id, policyContent(), '2026-05-20')
    return { ...existing, version: created }
  }
  return { ...existing, version }
}

async function provision(argv: string[], cfg?: CliConfig): Promise<ProtectResult> {
  const [kind, ...rest] = argv
  if (kind !== 'http') return usage('protect http --identifier <resource://id> --upstream-url <url> --scopes a,b --user <subject>')
  const ctx = buildAdminClient(cfg)
  const { client } = ctx
  const { flags } = parseArgs(rest)
  const identifier = flagString(flags, 'identifier')
  const upstreamUrl = flagString(flags, 'upstream-url')
  const scopes = flagList(flags, 'scopes')
  const userId = flagString(flags, 'user')
  if (!identifier || !upstreamUrl || !scopes || scopes.length === 0 || !userId) {
    return usage('protect http --identifier <resource://id> --upstream-url <url> --scopes a,b --user <subject>')
  }
  const zoneUrl = resolveZoneUrl(flags, cfg)

  const zone = await ensureZone(client, flagString(flags, 'zone') ?? ctx.zoneId, flagString(flags, 'zone-name') ?? DEFAULT_ZONE_NAME)
  const secret = clientSecret()
  const application = await ensureApplication(client, zone.id, flagString(flags, 'app-name') ?? `${zone.slug}-gateway-app`, secret)
  const resource = await ensureResource(
    client,
    zone.id,
    identifier,
    scopes,
    upstreamUrl,
    application.id,
    flagString(flags, 'resource-name') ?? identifier,
  )
  const policy = await ensurePolicy(client, zone.id, flagString(flags, 'policy-name') ?? POLICY_NAME)
  const policySetName = flagString(flags, 'policy-set-name') ?? POLICY_SET_NAME
  const policySets = await client.policySets.list(zone.id)
  const policySet = policySets.find((item) => item.name === policySetName) ?? await client.policySets.create(zone.id, policySetName, 'Local Gateway policy set')
  const policySetVersion = await client.policySets.addVersion(zone.id, policySet.id, [{ policy_version_id: policy.version.id }], '2026-05-20')
  const activated = await client.policySets.activate(zone.id, policySet.id, policySetVersion.id)
  const grants = await client.grants.list(zone.id)
  const existingGrant = grants.find((grant) =>
    grant.application_id === application.id &&
    grant.user_id === userId &&
    grant.resource_id === resource.id &&
    grant.status === 'active' &&
    sameScopes(grant.scopes, scopes),
  )
  const grant = existingGrant ?? await client.grants.create(zone.id, {
    application_id: application.id,
    user_id: userId,
    resource_id: resource.id,
    scopes,
  })
  const config = [
    `zone_url = "${zoneUrl}"`,
    `zone_id = "${zone.id}"`,
    '',
    `application_id = "${application.id}"`,
    `app_client_secret = "${secret}"`,
    '',
    '[[credentials]]',
    'env = "RESOURCE_TOKEN"',
    `resource = "${identifier}"`,
    '',
    '[mcp_governance]',
    'mode = "block"',
    '',
  ].join('\n')

  const printOnly = flagBool(flags, 'print-only')
  const force = flagBool(flags, 'force')
  const explicitPath = flagString(flags, 'write-config')
  const configPath = printOnly ? undefined : (explicitPath ?? 'caracal.toml')
  if (configPath) {
    if (existsSync(configPath) && !force) {
      throw new Error(`refusing to overwrite ${configPath}; pass --force to overwrite or --print-only to skip writing`)
    }
    writeFileSync(configPath, config, { mode: 0o600 })
  }

  return {
    zone,
    application,
    app_client_secret: secret,
    resource,
    policy,
    policy_version: policy.version,
    policy_set: { id: policySet.id, active_version_id: activated.version_id },
    grant,
    config,
    config_path: configPath,
  }
}

export async function protectCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h' || argv[0] === undefined) return help()
  const { flags } = parseArgs(argv.slice(1))
  const json = flagBool(flags, 'json')
  try {
    const result = await provision(argv, cfg)
    if (json) return printJSON(result)
    printSuccess('protected resource through the Gateway path')
    printInfo(`zone: ${result.zone.id}`)
    printInfo(`application: ${result.application.id}`)
    printInfo(`resource: ${result.resource.identifier}`)
    printInfo(`policy set: ${result.policy_set.id}`)
    printInfo(`grant: ${result.grant.id}`)
    if (result.config_path) {
      printSuccess(`wrote ${result.config_path} (mode 0600); app_client_secret is in the file and shown once`)
    } else {
      printStep('Store this caracal.toml content; app_client_secret is shown once.')
      process.stdout.write(result.config)
    }
  } catch (err) {
    fail(err)
  }
}

function help(): never {
  return showHelp(
    [
      'Usage: caracal protect http --identifier <resource://id> --upstream-url <url> --scopes a,b --user <subject>',
      '',
      'Creates or updates the local Gateway-first path: zone, Gateway app, resource route, policy, policy set, activation, grant, and caracal.toml values.',
      '',
      'Options:',
      '  --identifier <id>          Resource identifier URI (required)',
      '  --upstream-url <url>      HTTP upstream URL proxied by Gateway (required)',
      '  --scopes a,b              Comma-separated resource scopes (required)',
      '  --user <subject>          Subject/user ID for the initial grant (required)',
      '  --zone <id>               Existing zone; defaults to CARACAL_ZONE_ID or creates/uses Local Development',
      '  --zone-url <url>          STS base URL for generated caracal.toml',
      '  --zone-name <name>        Zone name when creating or finding a local zone',
      '  --app-name <name>         Gateway application name',
      '  --resource-name <name>    Resource display name',
      '  --policy-name <name>      Policy name',
      '  --policy-set-name <name>  Policy set name',
      '  --write-config <path>     Path for generated caracal.toml (default: caracal.toml in cwd, mode 0600)',
      '  --print-only              Print caracal.toml to stdout instead of writing it',
      '  --force                   Overwrite an existing config file',
      '  --json                    Emit machine-readable output',
      '  --help, -h                Show this help',
      '',
    ],
  )
}
