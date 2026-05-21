// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control API credential lifecycle helpers: list, create, rotate, and revoke OAuth apps with the `control:invoke` trait.

import { randomBytes } from 'node:crypto'
import type { AdminClient, Application, Resource } from '@caracalai/admin'
import { describeRemoteSurface } from './dispatch.js'

export const CONTROL_INVOKE_TRAIT = 'control:invoke'
export const DEFAULT_CONTROL_AUDIENCE = 'caracal-control'

export interface ControlKeyCreateInput {
  name: string
  audience?: string
}

export interface ControlKeyCreateResult {
  application: Application
  clientSecret: string
  resource: Resource
}

export interface ControlKeyRotateResult {
  application: Application
  clientSecret: string
}

export interface ControlKeyRecord {
  name: string
  client_id: string
  credential_type: Application['credential_type']
  traits: string[]
  created_at: string
}

function generateClientSecret(): string {
  return `cs_${randomBytes(32).toString('base64url')}`
}

function hasControlTrait(app: Application): boolean {
  return Array.isArray(app.traits) && app.traits.includes(CONTROL_INVOKE_TRAIT)
}

export function controlScopes(): string[] {
  return [...new Set(describeRemoteSurface().map((row) => row.scope))].sort()
}

export function controlKeyRecord(app: Application): ControlKeyRecord {
  return {
    name: app.name,
    client_id: app.id,
    credential_type: app.credential_type,
    traits: app.traits,
    created_at: app.created_at,
  }
}

export async function ensureControlResource(
  client: AdminClient,
  zoneId: string,
  audience = process.env.CONTROL_AUDIENCE ?? DEFAULT_CONTROL_AUDIENCE,
): Promise<Resource> {
  const scopes = controlScopes()
  const resources = await client.resources.list(zoneId)
  const current = resources.find((resource) => resource.identifier === audience)
  if (!current) {
    return client.resources.create(zoneId, {
      name: 'Control API',
      identifier: audience,
      scopes,
    })
  }
  const nextScopes = [...new Set([...current.scopes, ...scopes])].sort()
  if (nextScopes.length === current.scopes.length && nextScopes.every((scope, index) => scope === [...current.scopes].sort()[index])) {
    return current
  }
  return client.resources.patch(zoneId, current.id, { scopes: nextScopes })
}

export async function controlKeyList(client: AdminClient, zoneId: string): Promise<ControlKeyRecord[]> {
  const apps = await client.applications.list(zoneId)
  return apps.filter(hasControlTrait).map(controlKeyRecord)
}

async function requireControlApplication(client: AdminClient, zoneId: string, id: string): Promise<Application> {
  const app = await client.applications.get(zoneId, id)
  if (!hasControlTrait(app)) {
    throw new Error(`application ${id} is not a control API key (missing trait ${CONTROL_INVOKE_TRAIT})`)
  }
  return app
}

export async function controlKeyGet(client: AdminClient, zoneId: string, id: string): Promise<ControlKeyRecord> {
  return controlKeyRecord(await requireControlApplication(client, zoneId, id))
}

export async function controlKeyCreate(
  client: AdminClient,
  zoneId: string,
  input: ControlKeyCreateInput,
): Promise<ControlKeyCreateResult> {
  const resource = await ensureControlResource(client, zoneId, input.audience)
  const clientSecret = generateClientSecret()
  const application = await client.applications.create(zoneId, {
    name: input.name,
    registration_method: 'managed',
    credential_type: 'token',
    client_secret: clientSecret,
    traits: [CONTROL_INVOKE_TRAIT],
    consent: false,
  })
  return { application, clientSecret, resource }
}

export async function controlKeyRotate(
  client: AdminClient,
  zoneId: string,
  id: string,
): Promise<ControlKeyRotateResult> {
  await requireControlApplication(client, zoneId, id)
  await ensureControlResource(client, zoneId)
  const clientSecret = generateClientSecret()
  const application = await client.applications.patch(zoneId, id, { client_secret: clientSecret })
  return { application, clientSecret }
}

export async function controlKeyRevoke(client: AdminClient, zoneId: string, id: string): Promise<void> {
  await requireControlApplication(client, zoneId, id)
  await client.applications.delete(zoneId, id)
}
