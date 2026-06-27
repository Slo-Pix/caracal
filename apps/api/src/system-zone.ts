// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Idempotent provisioner for the reserved caracal.sys system zone the Operator self-governs through the control plane.

import type { AdminClient, Application, Zone } from '@caracalai/admin'
import { ensureControlResource } from '@caracalai/engine'
import { CONTROL_CAPABILITIES } from './operator-control-map.js'

// The reserved system zone, encoded per the caracal.sys namespace standard: a slug in the
// caracal-sys- form and a name in the caracal.sys/ form. Both are reserved, so only a
// global-scope platform actor may create them — exactly the bootstrap admin identity the
// provisioner runs as.
export const SYSTEM_ZONE_SLUG = 'caracal-sys-internal'
export const SYSTEM_ZONE_NAME = 'caracal.sys/system'

// The Operator's reserved control identity inside the system zone, named in the reserved
// caracal.sys/ form so a tenant can never create or impersonate it.
export const OPERATOR_APP_NAME = 'caracal.sys/operator'

const CONTROL_INVOKE_TRAIT = 'control:invoke'
const CONTROL_SCOPE_TRAIT_PREFIX = 'control:scope:'

// The least-privilege control scopes the Operator identity is granted: exactly the union
// of every governed-executable capability's scopes, so the identity can do everything the
// Operator may execute and nothing more. Adding a governed capability widens this set on
// the next provision; it never silently over-grants.
export function operatorControlScopes(): string[] {
  const scopes = new Set<string>()
  for (const capability of Object.values(CONTROL_CAPABILITIES)) {
    for (const scope of capability.scopes) scopes.add(scope)
  }
  return [...scopes].sort()
}

// The canonical trait set for the Operator identity: control:invoke plus one control:scope:
// trait per least-privilege scope. The provisioner reconciles the live identity to exactly
// this set on every run, so a hand-narrowed or widened identity self-heals to least
// privilege.
export function operatorIdentityTraits(): string[] {
  return [CONTROL_INVOKE_TRAIT, ...operatorControlScopes().map((scope) => `${CONTROL_SCOPE_TRAIT_PREFIX}${scope}`)].sort()
}

// The resolved system-zone identity the Operator executes as: the system zone it governs
// and the application id of its reserved control identity. The client secret is supplied
// separately from sealed config and is never returned here.
export interface SystemZoneIdentity {
  zoneId: string
  operatorApplicationId: string
}

function sameTraitSet(live: readonly string[] | undefined, desired: readonly string[]): boolean {
  const have = new Set(live ?? [])
  return have.size === desired.length && desired.every((trait) => have.has(trait))
}

async function ensureSystemZone(admin: AdminClient): Promise<Zone> {
  const zones = await admin.zones.list()
  const existing = zones.find((zone) => zone.slug === SYSTEM_ZONE_SLUG)
  if (existing) return existing
  return admin.zones.create({ name: SYSTEM_ZONE_NAME, slug: SYSTEM_ZONE_SLUG })
}

async function ensureOperatorIdentity(admin: AdminClient, zoneId: string, secret: string): Promise<string> {
  const traits = operatorIdentityTraits()
  const apps = await admin.applications.list(zoneId)
  const existing = apps.find((app: Application) => app.name === OPERATOR_APP_NAME)
  if (!existing) {
    const created = await admin.applications.create(zoneId, { name: OPERATOR_APP_NAME, registration_method: 'managed', traits })
    // Set the identity's secret to the sealed, configured value, so the running secret is
    // the platform's source of truth — supporting rotation by config change plus restart —
    // rather than the one-time secret minted at creation and never persisted.
    await admin.applications.patch(zoneId, created.id, { client_secret: secret })
    return created.id
  }
  // Reconcile the live identity to least privilege and the configured secret. Patching the
  // secret every run keeps the running credential equal to sealed config; patching traits
  // only when drifted avoids needless writes while still self-healing a tampered identity.
  if (!sameTraitSet(existing.traits, traits)) {
    await admin.applications.patch(zoneId, existing.id, { traits })
  }
  await admin.applications.patch(zoneId, existing.id, { client_secret: secret })
  return existing.id
}

// Provisions the reserved caracal.sys system zone and the Operator's least-privilege
// control identity within it, idempotently. Runs as the global-scope bootstrap admin
// identity (the only actor allowed to create reserved-namespace objects), using the same
// control primitives a customer uses: a real zone, the control resource, and a real
// least-privilege control application. Re-running converges without duplicating anything,
// so it is safe to call on every startup. Returns the resolved identity the Operator binds
// its governed execution to.
export async function provisionSystemZone(admin: AdminClient, operatorSecret: string): Promise<SystemZoneIdentity> {
  const zone = await ensureSystemZone(admin)
  await ensureControlResource(admin, zone.id)
  const operatorApplicationId = await ensureOperatorIdentity(admin, zone.id, operatorSecret)
  return { zoneId: zone.id, operatorApplicationId }
}
