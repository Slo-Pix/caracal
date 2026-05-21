// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Transport-neutral MCP authentication: bearer verify, revocation check, typed result.

import {
  AgentIdentityRequiredError,
  ChainMismatchError,
  DelegationRequiredError,
  HopCountExceededError,
  ScopeInsufficientError,
  TokenInvalidError,
  ZoneInvalidError,
  MANDATE_USE_RESOURCE,
  verify,
  type JwtConfig,
} from '@caracalai/identity'
import type { RevocationStore } from '@caracalai/revocation'
import type { AuthError, AuthResult, Principal } from './types.js'

export type AuthDeps = JwtConfig & { revocations: RevocationStore }

const BEARER_SCHEME = 'bearer'

export function extractBearer(authHeader: string | undefined): string | null {
  if (authHeader === undefined || authHeader.slice(0, BEARER_SCHEME.length).toLowerCase() !== BEARER_SCHEME) return null
  const value = authHeader.slice(BEARER_SCHEME.length)
  if (value.length === value.trimStart().length) return null
  const token = value.trim()
  return token === '' ? null : token
}

export async function authenticate(token: string, deps: AuthDeps): Promise<AuthResult> {
  if (!token) {
    return { ok: false, error: { code: 'missing_token', description: 'Missing bearer token' } }
  }

  try {
    const { revocations, ...jwtConfig } = deps
    const claims = await verify(token, { ...jwtConfig, requiredUse: jwtConfig.requiredUse ?? MANDATE_USE_RESOURCE })
    if (!revocations || typeof revocations.isRevoked !== 'function') {
      return { ok: false, error: { code: 'invalid_token', description: 'Revocation store required' } }
    }
    const activeError = await checkActiveAuthority(claims, revocations)
    if (activeError) {
      return { ok: false, error: activeError }
    }
    return { ok: true, principal: claims }
  } catch (err) {
    if (err instanceof ScopeInsufficientError) {
      return { ok: false, error: { code: 'insufficient_scope', description: err.message } }
    }
    if (err instanceof AgentIdentityRequiredError) {
      return { ok: false, error: { code: 'agent_required', description: err.message } }
    }
    if (err instanceof DelegationRequiredError) {
      return { ok: false, error: { code: 'delegation_required', description: err.message } }
    }
    if (err instanceof ChainMismatchError) {
      return { ok: false, error: { code: 'chain_mismatch', description: err.message } }
    }
    if (err instanceof HopCountExceededError) {
      return { ok: false, error: { code: 'hop_count_exceeded', description: err.message } }
    }
    if (err instanceof ZoneInvalidError) {
      return { ok: false, error: { code: 'invalid_zone', description: 'Token zone validation failed' } }
    }
    if (err instanceof TokenInvalidError) {
      return { ok: false, error: { code: 'invalid_token', description: 'Token validation failed' } }
    }
    return { ok: false, error: { code: 'invalid_token', description: 'Token validation failed' } }
  }
}

export async function checkActiveAuthority(claims: Principal, revocations: RevocationStore, nowMs = Date.now()): Promise<AuthError | null> {
  if (!claims.sid) {
    return { code: 'invalid_token', description: 'Token validation failed' }
  }
  if (claims.expiresAt * 1000 <= nowMs) {
    return { code: 'invalid_token', description: 'Token expired during execution' }
  }
  for (const anchor of revocationAnchors(claims)) {
    if (await revocations.isRevoked(anchor)) {
      return { code: 'session_revoked', description: 'Session revoked' }
    }
  }
  return null
}

function revocationAnchors(claims: Principal): string[] {
  const anchors = [
    claims.sid,
    claims.rootSid,
    claims.agentSessionId,
    claims.delegationEdgeId,
  ].filter((value): value is string => typeof value === 'string' && value !== '')
  return [...new Set(anchors)]
}
