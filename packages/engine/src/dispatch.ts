// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared command dispatcher: validates a (command, subcommand, flags) request against the canonical catalog and forwards it to the AdminClient surface used by CLI, TUI, and the Control API.

import type { AdminClient } from '@caracalai/admin'
import {
  CLI_COMMANDS,
  findCommand,
  scopeName,
  type CommandDescriptor,
} from './commands.js'

export type FlagValue = string | number | boolean | null | readonly (string | number | boolean | null)[]
export type FlagMap = { readonly [key: string]: FlagValue }

export interface DispatchRequest {
  readonly command: string
  readonly subcommand: string
  readonly flags?: FlagMap
}

/** A caller of dispatch. `local` principals (CLI/TUI) bypass scope checks; `remote` principals (Control) must carry per-resource scopes. */
export interface Principal {
  readonly kind: 'local' | 'remote'
  readonly subject: string
  readonly zoneId?: string
  readonly clientId?: string
  readonly scopes: readonly string[]
}

export interface DispatchContext {
  readonly admin: AdminClient
  readonly requestId?: string
}

export class DispatchError extends Error {
  constructor(readonly code: 'denied' | 'unsupported' | 'invalid', message: string) {
    super(message)
    this.name = 'DispatchError'
  }
}

const MAX_FLAGS = 32
const MAX_FLAG_KEY_LEN = 64
const MAX_FLAG_STR_LEN = 4096
const MAX_FLAG_ARRAY_LEN = 64

function denied(msg: string): never { throw new DispatchError('denied', msg) }
function unsupported(msg: string): never { throw new DispatchError('unsupported', msg) }
function invalid(msg: string): never { throw new DispatchError('invalid', msg) }

/** Reject flag payloads outside the bounded, flat shape Control accepts. */
export function validateFlags(flags: FlagMap | undefined): void {
  if (!flags) return
  const keys = Object.keys(flags)
  if (keys.length > MAX_FLAGS) invalid(`too many flags (max ${MAX_FLAGS})`)
  for (const k of keys) {
    if (k.length === 0 || k.length > MAX_FLAG_KEY_LEN) invalid(`flag key "${k}" out of range`)
    const v = flags[k]
    if (v === null || typeof v === 'boolean' || typeof v === 'number') continue
    if (typeof v === 'string') {
      if (v.length > MAX_FLAG_STR_LEN) invalid(`flag "${k}" string too long`)
      continue
    }
    if (Array.isArray(v)) {
      if (v.length > MAX_FLAG_ARRAY_LEN) invalid(`flag "${k}" array too long`)
      for (const e of v) {
        if (e === null || typeof e === 'boolean' || typeof e === 'number') continue
        if (typeof e === 'string') {
          if (e.length > MAX_FLAG_STR_LEN) invalid(`flag "${k}" element too long`)
          continue
        }
        invalid(`flag "${k}" has unsupported array element`)
      }
      continue
    }
    invalid(`flag "${k}" has unsupported type`)
  }
}

function assertScope(principal: Principal, desc: CommandDescriptor, sub: string): void {
  if (principal.kind === 'local') return
  const required = scopeName(desc, sub)
  if (principal.scopes.includes(required)) return
  denied(`missing scope ${required}`)
}

function getStr(flags: FlagMap | undefined, key: string): string | undefined {
  const v = flags?.[key]
  return typeof v === 'string' ? v : undefined
}

function mustStr(flags: FlagMap | undefined, key: string): string {
  const v = getStr(flags, key)
  if (!v) invalid(`flag "${key}" is required`)
  return v
}

function getNum(flags: FlagMap | undefined, key: string): number | undefined {
  const v = flags?.[key]
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function getBool(flags: FlagMap | undefined, key: string): boolean | undefined {
  const v = flags?.[key]
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}

function requireZone(principal: Principal): string {
  if (!principal.zoneId) invalid('zone_id is required')
  return principal.zoneId
}

type Handler = (input: {
  sub: string
  flags: FlagMap
  principal: Principal
  ctx: DispatchContext
}) => Promise<unknown>

function bySubcommand(handlers: Record<string, Handler>): Handler {
  return async (input) => {
    const h = handlers[input.sub]
    if (!h) unsupported(`subcommand "${input.sub}" not implemented`)
    return h(input)
  }
}

const zoneHandler = bySubcommand({
  list: ({ ctx }) => ctx.admin.zones.list(),
  get: ({ flags, ctx }) => ctx.admin.zones.get(mustStr(flags, 'id')),
  create: ({ flags, ctx }) => ctx.admin.zones.create({
    name: mustStr(flags, 'name'),
    slug: getStr(flags, 'slug'),
    organization_id: getStr(flags, 'org'),
    dcr_enabled: getBool(flags, 'dcr'),
    require_pkce: getBool(flags, 'pkce'),
    login_flow: getStr(flags, 'login-flow'),
  } as never),
  patch: ({ flags, ctx }) => ctx.admin.zones.patch(mustStr(flags, 'id'), {
    name: getStr(flags, 'name'),
    slug: getStr(flags, 'slug'),
    organization_id: getStr(flags, 'org'),
    dcr_enabled: getBool(flags, 'dcr'),
    require_pkce: getBool(flags, 'pkce'),
    login_flow: getStr(flags, 'login-flow'),
  } as never),
  delete: ({ flags, ctx }) => ctx.admin.zones.delete(mustStr(flags, 'id')),
})

const appHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.applications.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.applications.get(requireZone(principal), mustStr(flags, 'id')),
  create: ({ principal, flags, ctx }) => ctx.admin.applications.create(requireZone(principal), {
    name: mustStr(flags, 'name'),
    credential_type: getStr(flags, 'credential-type'),
    client_secret: getStr(flags, 'client-secret'),
    auth_method: getStr(flags, 'method'),
    require_consent: getBool(flags, 'consent'),
    token_expires_in: getNum(flags, 'expires-in'),
  } as never),
  patch: ({ principal, flags, ctx }) => ctx.admin.applications.patch(requireZone(principal), mustStr(flags, 'id'), {
    name: getStr(flags, 'name'),
    require_consent: getBool(flags, 'consent'),
    token_expires_in: getNum(flags, 'expires-in'),
  } as never),
  delete: ({ principal, flags, ctx }) => ctx.admin.applications.delete(requireZone(principal), mustStr(flags, 'id')),
  dcr: ({ principal, flags, ctx }) => ctx.admin.applications.dcr(requireZone(principal), {
    client_secret: mustStr(flags, 'client-secret'),
  } as never),
})

const resourceHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.resources.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.resources.get(requireZone(principal), mustStr(flags, 'id')),
  create: ({ principal, flags, ctx }) => ctx.admin.resources.create(requireZone(principal), {
    name: mustStr(flags, 'name'),
    identifier: mustStr(flags, 'identifier'),
    upstream_url: getStr(flags, 'upstream-url'),
    provider_id: getStr(flags, 'provider'),
    treat_identifier_as_prefix: getBool(flags, 'prefix'),
  } as never),
  patch: ({ principal, flags, ctx }) => ctx.admin.resources.patch(requireZone(principal), mustStr(flags, 'id'), {
    name: getStr(flags, 'name'),
    upstream_url: getStr(flags, 'upstream-url'),
    treat_identifier_as_prefix: getBool(flags, 'prefix'),
  } as never),
  delete: ({ principal, flags, ctx }) => ctx.admin.resources.delete(requireZone(principal), mustStr(flags, 'id')),
})

const providerHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.providers.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.providers.get(requireZone(principal), mustStr(flags, 'id')),
  create: ({ principal, flags, ctx }) => ctx.admin.providers.create(requireZone(principal), {
    name: mustStr(flags, 'name'),
    identifier: mustStr(flags, 'identifier'),
    kind: mustStr(flags, 'kind'),
    client_id: getStr(flags, 'client-id'),
    owner_type: getStr(flags, 'owner-type'),
    config: getStr(flags, 'config'),
  } as never),
  patch: ({ principal, flags, ctx }) => ctx.admin.providers.patch(requireZone(principal), mustStr(flags, 'id'), {
    name: getStr(flags, 'name'),
    client_id: getStr(flags, 'client-id'),
    config: getStr(flags, 'config'),
  } as never),
  delete: ({ principal, flags, ctx }) => ctx.admin.providers.delete(requireZone(principal), mustStr(flags, 'id')),
})

const policyHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.policies.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.policies.get(requireZone(principal), mustStr(flags, 'id')),
  create: ({ principal, flags, ctx }) => ctx.admin.policies.create(requireZone(principal), {
    name: mustStr(flags, 'name'),
    description: getStr(flags, 'description'),
    content: mustStr(flags, 'content'),
    schema_version: getStr(flags, 'schema-version'),
    owner_type: getStr(flags, 'owner-type'),
    shadow: getBool(flags, 'shadow'),
  } as never),
  version: ({ principal, flags, ctx }) => ctx.admin.policies.addVersion(
    requireZone(principal),
    mustStr(flags, 'id'),
    mustStr(flags, 'content'),
    getStr(flags, 'schema-version'),
  ),
  delete: ({ principal, flags, ctx }) => ctx.admin.policies.delete(requireZone(principal), mustStr(flags, 'id')),
})

const policySetHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.policySets.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.policySets.get(requireZone(principal), mustStr(flags, 'id')),
  create: ({ principal, flags, ctx }) => ctx.admin.policySets.create(
    requireZone(principal),
    mustStr(flags, 'name'),
    getStr(flags, 'description'),
  ),
  activate: ({ principal, flags, ctx }) => ctx.admin.policySets.activate(
    requireZone(principal),
    mustStr(flags, 'id'),
    mustStr(flags, 'version-id'),
    getStr(flags, 'shadow-version-id'),
  ),
  delete: ({ principal, flags, ctx }) => ctx.admin.policySets.delete(requireZone(principal), mustStr(flags, 'id')),
})

const grantHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.grants.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.grants.get(requireZone(principal), mustStr(flags, 'id')),
  create: ({ principal, flags, ctx }) => ctx.admin.grants.create(requireZone(principal), {
    application_id: mustStr(flags, 'app'),
    resource_id: mustStr(flags, 'resource'),
    subject_id: getStr(flags, 'user'),
  } as never),
  revoke: ({ principal, flags, ctx }) => ctx.admin.grants.revoke(requireZone(principal), mustStr(flags, 'id')),
  delete: ({ principal, flags, ctx }) => ctx.admin.grants.revoke(requireZone(principal), mustStr(flags, 'id')),
})

const sessionHandler = bySubcommand({
  list: ({ principal, flags, ctx }) => ctx.admin.sessions.list(requireZone(principal), {
    subject: getStr(flags, 'subject'),
    status: getStr(flags, 'status'),
    limit: getNum(flags, 'limit'),
  } as never),
})

const auditHandler = bySubcommand({
  tail: ({ principal, flags, ctx }) => ctx.admin.audit.list(requireZone(principal), {
    since: getStr(flags, 'since'),
    until: getStr(flags, 'until'),
    decision: getStr(flags, 'decision'),
    event_type: getStr(flags, 'event-type'),
    request_id: getStr(flags, 'request-id'),
    limit: getNum(flags, 'limit'),
  } as never),
})

const explainHandler: Handler = async ({ principal, flags, ctx }) =>
  ctx.admin.audit.byRequest(requireZone(principal), mustStr(flags, 'request-id'))

const agentHandler = bySubcommand({
  list: ({ principal, ctx }) => ctx.admin.agents.list(requireZone(principal)),
  get: ({ principal, flags, ctx }) => ctx.admin.agents.get(requireZone(principal), mustStr(flags, 'id')),
  children: ({ principal, flags, ctx }) => ctx.admin.agents.children(requireZone(principal), mustStr(flags, 'id')),
  tree: ({ principal, flags, ctx }) => ctx.admin.agents.children(requireZone(principal), mustStr(flags, 'id')),
  suspend: ({ principal, flags, ctx }) => ctx.admin.agents.suspend(requireZone(principal), mustStr(flags, 'id')),
  resume: ({ principal, flags, ctx }) => ctx.admin.agents.resume(requireZone(principal), mustStr(flags, 'id')),
  terminate: ({ principal, flags, ctx }) => ctx.admin.agents.terminate(requireZone(principal), mustStr(flags, 'id')),
})

const delegationHandler = bySubcommand({
  inbound: ({ principal, flags, ctx }) => ctx.admin.delegations.inbound(requireZone(principal), mustStr(flags, 'session-id')),
  outbound: ({ principal, flags, ctx }) => ctx.admin.delegations.outbound(requireZone(principal), mustStr(flags, 'session-id')),
  traverse: ({ principal, flags, ctx }) => ctx.admin.delegations.traverse(requireZone(principal), mustStr(flags, 'id')),
  revoke: ({ principal, flags, ctx }) => ctx.admin.delegations.revoke(requireZone(principal), mustStr(flags, 'id')),
})

/** Commands the Control API exposes. Local-only descriptors (`run`, `credential`, `control`, `completion`) are intentionally absent. */
const HANDLERS: ReadonlyMap<string, Handler> = new Map<string, Handler>([
  ['zone', zoneHandler],
  ['app', appHandler],
  ['resource', resourceHandler],
  ['provider', providerHandler],
  ['policy', policyHandler],
  ['policy-set', policySetHandler],
  ['grant', grantHandler],
  ['session', sessionHandler],
  ['audit', auditHandler],
  ['explain', explainHandler],
  ['agent', agentHandler],
  ['delegation', delegationHandler],
])

/**
 * Validate and execute a dispatch request against the canonical catalog. Throws DispatchError on rejection.
 * Local principals (CLI/TUI) skip scope checks. Remote principals (Control) must carry the per-resource scope
 * derived from `scopeName(descriptor, subcommand)`.
 */
export async function dispatch(
  req: DispatchRequest,
  principal: Principal,
  ctx: DispatchContext,
): Promise<unknown> {
  const desc = findCommand(CLI_COMMANDS, req.command)
  if (!desc) denied(`unknown command "${req.command}"`)
  if (desc.hidden && principal.kind === 'remote') denied(`command "${req.command}" not exposed`)
  if (desc.subcommands && desc.subcommands.length > 0) {
    if (!desc.subcommands.includes(req.subcommand)) {
      denied(`subcommand "${req.subcommand}" not allowed for "${req.command}"`)
    }
  } else if (req.subcommand && req.subcommand !== '') {
    denied(`command "${req.command}" takes no subcommand`)
  }
  validateFlags(req.flags)
  assertScope(principal, desc, req.subcommand)
  const handler = HANDLERS.get(req.command)
  if (!handler) unsupported(`command "${req.command}" has no handler`)
  return handler({
    sub: req.subcommand,
    flags: req.flags ?? {},
    principal,
    ctx,
  })
}

/** Lists the (command, subcommand, scope) triples the Control API exposes — used by tests and documentation. */
export function describeRemoteSurface(): readonly { command: string; subcommand: string; scope: string }[] {
  const out: { command: string; subcommand: string; scope: string }[] = []
  for (const desc of CLI_COMMANDS) {
    if (desc.hidden) continue
    if (!HANDLERS.has(desc.name)) continue
    const subs = desc.subcommands && desc.subcommands.length > 0 ? desc.subcommands : ['']
    for (const sub of subs) {
      out.push({ command: desc.name, subcommand: sub, scope: scopeName(desc, sub) })
    }
  }
  return out
}
