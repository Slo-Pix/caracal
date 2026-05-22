// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared credential commands for reading scoped tokens and inspecting JWT claims.

import { OAuthClient } from '@caracalai/oauth'
import type { CliConfig } from './cliconfig.js'

export interface CredentialReadOpts {
  cfg: CliConfig
  resource: string
  ttlSeconds?: number
}

export interface TokenInspection {
  verified: false
  summary: Record<string, string | number>
  header: Record<string, unknown>
  claims: Record<string, unknown>
}

type TokenStatus = 'active' | 'expired' | 'not_yet_valid' | 'missing_expiry'

const DEFAULT_TTL_SECONDS = 900

export async function credentialRead(opts: CredentialReadOpts): Promise<string> {
  if (!opts.resource) throw new Error('resource is required')
  const cfg = opts.cfg
  const client = new OAuthClient(cfg.zone_url, cfg.zone_id, cfg.application_id)
  const token = await client.exchange('', opts.resource, {
    clientSecret: cfg.app_client_secret,
    ttlSeconds: opts.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  })
  return token.accessToken
}

export function credentialInspect(token: string): TokenInspection {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || parts.some((part) => part === '')) {
    throw new Error('invalid JWT: expected three non-empty base64url segments')
  }
  const header = decodeSegment(parts[0]!, 'header')
  const claims = decodeSegment(parts[1]!, 'claims')
  const now = Math.floor(Date.now() / 1000)
  const exp = numberClaim(claims, 'exp')
  const nbf = numberClaim(claims, 'nbf')
  const iat = numberClaim(claims, 'iat')
  const resource = claimList(claims, 'target') ?? claimList(claims, 'resource') ?? claimList(claims, 'aud')
  const scopes = claimList(claims, 'scope') ?? claimList(claims, 'scp')
  const summary: Record<string, string | number> = {
    verification: 'not_verified',
    status: tokenStatus(now, exp, nbf),
    issuer: stringClaim(claims, 'iss') ?? '-',
    subject: stringClaim(claims, 'sub') ?? '-',
    audience: (claimList(claims, 'aud') ?? ['-']).join(','),
    zone: stringClaim(claims, 'zone_id') ?? '-',
    session: stringClaim(claims, 'root_sid') ?? stringClaim(claims, 'session_id') ?? stringClaim(claims, 'sid') ?? '-',
    agent_run: stringClaim(claims, 'agent_session_id') ?? '-',
    delegated_permission: stringClaim(claims, 'delegation_edge_id') ?? '-',
    resource: resource?.join(',') ?? '-',
    scopes: scopes?.join(' ') ?? '-',
    issued_at: iat !== undefined ? new Date(iat * 1000).toISOString() : '-',
    not_before: nbf !== undefined ? new Date(nbf * 1000).toISOString() : '-',
    expires_at: exp !== undefined ? new Date(exp * 1000).toISOString() : '-',
    seconds_until_expiry: exp !== undefined ? exp - now : '-',
    algorithm: stringClaim(header, 'alg') ?? '-',
    key_id: stringClaim(header, 'kid') ?? '-',
    token_id: stringClaim(claims, 'jti') ?? '-',
  }
  return { verified: false, summary, header, claims }
}

function decodeSegment(segment: string, name: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${name} segment is not a JSON object`)
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`invalid JWT ${name} segment: ${reason}`)
  }
}

function stringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function numberClaim(claims: Record<string, unknown>, key: string): number | undefined {
  const value = claims[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function claimList(claims: Record<string, unknown>, key: string): string[] | undefined {
  const value = claims[key]
  if (Array.isArray(value)) {
    const list = value.filter((item): item is string => typeof item === 'string' && item !== '')
    return list.length > 0 ? list : undefined
  }
  if (typeof value === 'string' && value !== '') return value.split(/\s+/).filter(Boolean)
  return undefined
}

function tokenStatus(now: number, exp: number | undefined, nbf: number | undefined): TokenStatus {
  if (nbf !== undefined && now < nbf) return 'not_yet_valid'
  if (exp === undefined) return 'missing_expiry'
  return now >= exp ? 'expired' : 'active'
}
