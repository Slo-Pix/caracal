// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Bearer-token authenticator: validates STS-issued ES256 JWTs against a zone-scoped JWKS and surfaces claims for the dispatch layer.

import { createLocalJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export interface Claims {
  sub: string
  jti: string
  zoneId: string
  clientId: string
  scope: string
  exp: number | undefined
}

interface ZoneEntry {
  keySet: JWTVerifyGetKey
  loadedAt: number
}

export interface AuthOptions {
  jwksUrl: string
  issuer: string
  audience: string
  refreshFloorMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_REFRESH_FLOOR_MS = 30_000

export class Authenticator {
  private readonly opts: AuthOptions
  private readonly zones = new Map<string, ZoneEntry>()
  private readonly refreshFloorMs: number

  constructor(opts: AuthOptions) {
    this.opts = opts
    this.refreshFloorMs = opts.refreshFloorMs ?? DEFAULT_REFRESH_FLOOR_MS
  }

  async verify(authHeader: string | undefined): Promise<Claims> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('missing bearer token')
    }
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) throw new AuthError('missing bearer token')

    const peek = decodePayload(token)
    const zoneId = typeof peek['zone_id'] === 'string' ? (peek['zone_id'] as string) : ''
    if (!zoneId) throw new AuthError('missing zone_id')

    const keySet = await this.keySet(zoneId, false)
    let payload
    try {
      ;({ payload } = await jwtVerify(token, keySet, {
        issuer: this.opts.issuer,
        audience: this.opts.audience,
        algorithms: ['ES256'],
        requiredClaims: ['exp', 'iat', 'jti', 'sub'],
      }))
    } catch (err) {
      if (isKeyMiss(err)) {
        const refreshed = await this.keySet(zoneId, true)
        ;({ payload } = await jwtVerify(token, refreshed, {
          issuer: this.opts.issuer,
          audience: this.opts.audience,
          algorithms: ['ES256'],
          requiredClaims: ['exp', 'iat', 'jti', 'sub'],
        }).catch((e) => { throw new AuthError(`invalid token: ${describe(e)}`) }))
      } else {
        throw new AuthError(`invalid token: ${describe(err)}`)
      }
    }

    const claims: Claims = {
      sub: requireString(payload, 'sub'),
      jti: requireString(payload, 'jti'),
      zoneId,
      clientId: optionalString(payload, 'client_id') ?? '',
      scope: optionalString(payload, 'scope') ?? '',
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    }
    if (typeof payload['zone_id'] !== 'string' || payload['zone_id'] !== zoneId) {
      throw new AuthError('zone_id mismatch')
    }
    return claims
  }

  private async keySet(zoneId: string, force: boolean): Promise<JWTVerifyGetKey> {
    const cached = this.zones.get(zoneId)
    if (cached && !force) return cached.keySet
    const set = await fetchJwks(this.opts, zoneId)
    this.zones.set(zoneId, { keySet: set, loadedAt: Date.now() })
    return set
  }
}

async function fetchJwks(opts: AuthOptions, zoneId: string): Promise<JWTVerifyGetKey> {
  const fetcher = opts.fetchImpl ?? fetch
  const u = new URL(opts.jwksUrl)
  u.searchParams.set('zone_id', zoneId)
  const res = await fetcher(u.toString(), { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new AuthError(`jwks status ${res.status}`)
  const body = (await res.json()) as { keys?: object[] }
  if (!body.keys || !Array.isArray(body.keys)) throw new AuthError('jwks: malformed')
  return createLocalJWKSet({ keys: body.keys } as Parameters<typeof createLocalJWKSet>[0])
}

function decodePayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new AuthError('malformed token')
  try {
    const json = Buffer.from(parts[1]!, 'base64url').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    throw new AuthError('malformed token payload')
  }
}

function requireString(payload: Record<string, unknown>, name: string): string {
  const v = payload[name]
  if (typeof v !== 'string' || v === '') throw new AuthError(`claim ${name} required`)
  return v
}

function optionalString(payload: Record<string, unknown>, name: string): string | undefined {
  const v = payload[name]
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string') throw new AuthError(`claim ${name} must be a string`)
  return v
}

function isKeyMiss(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  return code === 'ERR_JWKS_NO_MATCHING_KEY' || code === 'ERR_JWKS_MULTIPLE_MATCHING_KEYS'
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
