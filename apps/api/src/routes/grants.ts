// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Delegated grant CRUD routes: creation and revocation with session invalidation.

import type { FastifyPluginAsync } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import { loadZoneKek, open, seal } from '@caracalai/core'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { scopesAllowed } from '@caracalai/core'
import { STREAM_SESSIONS_REVOKE } from '../redis.js'
import { enqueueOutbox } from '../outbox.js'
import { ZoneIdParams, ZoneParams, parseParams } from './params.js'
import { zoneExists } from '../zone-guard.js'
import { appendKeysetCondition, parseListPagination, setNextLink } from './list-pagination.js'

const SESSION_REVOKE_BATCH = 1000

// Scope strings cross trust boundaries (Rego policies, upstream IdPs). Restrict to a
// safe charset and bounded length so neither side has to sanitize control characters,
// whitespace, or absurdly long values.
const ScopePattern = /^[a-z0-9:_./-]+$/
const ScopeMaxLen = 200
const Scope = z.string().min(1).max(ScopeMaxLen).regex(ScopePattern)

const GrantBody = z.object({
  application_id: z.string().min(1),
  user_id: z.string().min(1),
  resource_id: z.string().min(1),
  scopes: z.array(Scope).min(1).max(64),
})

const ProviderGrantBody = z.object({
  user_id: z.string().min(1),
  resource_id: z.string().min(1),
  provider_id: z.string().min(1),
  scopes: z.array(Scope).min(1).max(64),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_at: z.string().datetime().optional(),
})

const ProviderGrantOAuthAuthorizeBody = z.object({
  user_id: z.string().min(1),
  resource_id: z.string().min(1),
  provider_id: z.string().min(1),
  scopes: z.array(Scope).min(1).max(64),
})

const OAuthCallbackQuery = z.object({
  state: z.string().min(32).max(256),
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  error_description: z.string().min(1).optional(),
})

const OAuthStateBody = z.object({
  zone_id: z.string().min(1),
  user_id: z.string().min(1),
  resource_id: z.string().min(1),
  provider_id: z.string().min(1),
  scopes: z.array(Scope).min(1).max(64),
  code_verifier: z.string().min(43).max(128),
})

const OAUTH_STATE_TTL_SECONDS = 10 * 60
const OAUTH_STATE_KEY_PREFIX = 'api:provider_oauth_state:'
const PROVIDER_TOKEN_EXCHANGE_TIMEOUT_MS = 15_000

interface ProviderOAuthRow {
  id: string
  provider_kind: string
  config_json: Record<string, unknown>
  secret_config_ct: Buffer | null
  secret_config_nonce: Buffer | null
  resource_scopes: string[] | null
  resource_provider_id: string | null
}

interface ProviderSecretConfig {
  client_secret?: string
}

function sealText(value: string): Buffer {
  const sealed = seal(loadZoneKek(), Buffer.from(value, 'utf8'))
  return Buffer.concat([sealed.nonce, sealed.ciphertext])
}

function openProviderSecretConfig(row: ProviderOAuthRow): ProviderSecretConfig {
  if (!row.secret_config_ct || !row.secret_config_nonce) return {}
  const plaintext = open(loadZoneKek(), { nonce: row.secret_config_nonce, ciphertext: row.secret_config_ct })
  try {
    return JSON.parse(plaintext.toString('utf8')) as ProviderSecretConfig
  } finally {
    plaintext.fill(0)
  }
}

function randomUrlToken(): string {
  return randomBytes(32).toString('base64url')
}

function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function stringConfig(config: Record<string, unknown>, key: string): string {
  const value = config[key]
  return typeof value === 'string' ? value.trim() : ''
}

function stringListConfig(config: Record<string, unknown>, key: string): string[] {
  const value = config[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim()) : []
}

function recordConfig(config: Record<string, unknown>, key: string): Record<string, string> {
  const value = config[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const params: Record<string, string> = {}
  for (const [name, item] of Object.entries(value)) {
    if (typeof item === 'string' && item.trim().length > 0) params[name] = item.trim()
  }
  return params
}

function ensureAllowedTokenEndpoint(raw: string, hosts: string[]): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('provider token endpoint must be https')
  }
  if (!hosts.some(host => host.trim().toLowerCase() === url.hostname.toLowerCase())) {
    throw new Error('provider token endpoint host is not allowlisted')
  }
  return url
}

function buildTokenRequest(form: URLSearchParams, clientId: string, clientSecret: string, method: string): RequestInit {
  const body = new URLSearchParams(form)
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (method === 'client_secret_post') {
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
  } else if (method === 'none') {
    body.set('client_id', clientId)
  } else {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }
  return { method: 'POST', headers, body, redirect: 'manual' }
}

export const grantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/zones/:zoneId/grants', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    const page = parseListPagination(req, reply)
    if (!page) return
    const keyset = appendKeysetCondition(
      { conds: ['zone_id = $1'], values: [params.zoneId] },
      page,
    )
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, application_id, user_id, resource_id, scopes, status, created_at
       FROM delegated_grants WHERE ${keyset.conds.join(' AND ')}
       ORDER BY created_at DESC, id DESC LIMIT ${keyset.limitPlaceholder}`,
      keyset.values,
    )
    setNextLink(req, reply, rows, page.limit)
    return rows
  })

  fastify.get('/zones/:zoneId/grants/:id', async (req, reply) => {
    const params = parseParams(ZoneIdParams, req, reply)
    if (!params) return
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, application_id, user_id, resource_id, scopes, status, created_at
       FROM delegated_grants WHERE id = $1 AND zone_id = $2`,
      [params.id, params.zoneId],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'grant_not_found' })
    return rows[0]
  })

  fastify.post('/zones/:zoneId/grants', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    if (!(await zoneExists(fastify.db, params.zoneId))) {
      return reply.code(404).send({ error: 'zone_not_found' })
    }
    const body = GrantBody.parse(req.body)
    const { rows: refs } = await fastify.db.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM applications
           WHERE id = $2 AND zone_id = $1 AND archived_at IS NULL
             AND (expires_at IS NULL OR expires_at > now())
         ) AS application_exists,
         (SELECT scopes FROM resources WHERE id = $3 AND zone_id = $1 AND archived_at IS NULL) AS resource_scopes`,
      [params.zoneId, body.application_id, body.resource_id],
    )
    if (!refs[0]?.application_exists) {
      return reply.code(404).send({ error: 'application_not_found' })
    }
    if (!refs[0].resource_scopes) {
      return reply.code(404).send({ error: 'resource_not_found' })
    }
    if (!scopesAllowed(body.scopes, refs[0].resource_scopes)) {
      return reply.code(403).send({ error: 'grant_scopes_exceed_resource' })
    }
    const id = uuidv7()
    const { rows } = await fastify.db.query(
      `INSERT INTO delegated_grants (id, zone_id, application_id, user_id, resource_id, scopes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING id, zone_id, application_id, user_id, resource_id, scopes, status, created_at`,
      [id, params.zoneId, body.application_id, body.user_id, body.resource_id, body.scopes],
    )
    return reply.code(201).send(rows[0])
  })

  fastify.post('/zones/:zoneId/provider-grants', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    if (!(await zoneExists(fastify.db, params.zoneId))) {
      return reply.code(404).send({ error: 'zone_not_found' })
    }
    const parsed = ProviderGrantBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_provider_grant' })
    const body = parsed.data
    const { rows: refs } = await fastify.db.query<{
      provider_kind: string | null
      resource_scopes: string[] | null
      resource_provider_id: string | null
    }>(
      `SELECT
         (SELECT provider_kind FROM providers WHERE id = $2 AND zone_id = $1 AND archived_at IS NULL) AS provider_kind,
         (SELECT scopes FROM resources WHERE id = $3 AND zone_id = $1 AND archived_at IS NULL) AS resource_scopes,
         (SELECT credential_provider_id FROM resources WHERE id = $3 AND zone_id = $1 AND archived_at IS NULL) AS resource_provider_id`,
      [params.zoneId, body.provider_id, body.resource_id],
    )
    const refsRow = refs[0]
    if (!refsRow?.provider_kind) return reply.code(404).send({ error: 'provider_not_found' })
    if (refsRow.provider_kind !== 'oauth2_authorization_code') {
      return reply.code(400).send({ error: 'provider_grant_unsupported', detail: 'only oauth2_authorization_code providers use delegated provider grants' })
    }
    if (!refsRow.resource_scopes) return reply.code(404).send({ error: 'resource_not_found' })
    if (refsRow.resource_provider_id !== body.provider_id) {
      return reply.code(400).send({ error: 'provider_resource_mismatch' })
    }
    if (!scopesAllowed(body.scopes, refsRow.resource_scopes)) {
      return reply.code(403).send({ error: 'grant_scopes_exceed_resource' })
    }
    const id = uuidv7()
    const accessTokenCt = sealText(body.access_token)
    const refreshTokenCt = body.refresh_token ? sealText(body.refresh_token) : null
    const { rows } = await fastify.db.query(
      `INSERT INTO provider_grants (id, zone_id, user_id, resource_id, provider_id, scopes,
                                   access_token_ct, refresh_token_ct, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, zone_id, user_id, resource_id, provider_id, scopes, status, expires_at, created_at`,
      [id, params.zoneId, body.user_id, body.resource_id, body.provider_id, body.scopes, accessTokenCt, refreshTokenCt, body.expires_at ?? null],
    )
    return reply.code(201).send(rows[0])
  })

  fastify.post('/zones/:zoneId/provider-grants/oauth/authorize', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    if (!(await zoneExists(fastify.db, params.zoneId))) {
      return reply.code(404).send({ error: 'zone_not_found' })
    }
    const parsed = ProviderGrantOAuthAuthorizeBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_provider_oauth_authorize' })
    const body = parsed.data
    const { rows } = await fastify.db.query<ProviderOAuthRow>(
      `SELECT
         p.id, p.provider_kind, p.config_json, p.secret_config_ct, p.secret_config_nonce,
         r.scopes AS resource_scopes, r.credential_provider_id AS resource_provider_id
       FROM providers p
       LEFT JOIN resources r ON r.zone_id = p.zone_id AND r.id = $3 AND r.archived_at IS NULL
       WHERE p.zone_id = $1 AND p.id = $2 AND p.archived_at IS NULL`,
      [params.zoneId, body.provider_id, body.resource_id],
    )
    const row = rows[0]
    if (!row) return reply.code(404).send({ error: 'provider_not_found' })
    if (row.provider_kind !== 'oauth2_authorization_code') {
      return reply.code(400).send({ error: 'provider_grant_unsupported', detail: 'only oauth2_authorization_code providers use browser authorization' })
    }
    if (!row.resource_scopes) return reply.code(404).send({ error: 'resource_not_found' })
    if (row.resource_provider_id !== body.provider_id) {
      return reply.code(400).send({ error: 'provider_resource_mismatch' })
    }
    if (!scopesAllowed(body.scopes, row.resource_scopes)) {
      return reply.code(403).send({ error: 'grant_scopes_exceed_resource' })
    }

    const config = row.config_json
    const authorizationEndpoint = stringConfig(config, 'authorization_endpoint')
    const redirectUri = stringConfig(config, 'redirect_uri')
    const clientId = stringConfig(config, 'client_id')
    if (!authorizationEndpoint || !redirectUri || !clientId) {
      return reply.code(400).send({ error: 'invalid_provider_config' })
    }
    const authorizationUrl = new URL(authorizationEndpoint)
    const state = randomUrlToken()
    const codeVerifier = randomUrlToken()
    const stateBody = {
      zone_id: params.zoneId,
      user_id: body.user_id,
      resource_id: body.resource_id,
      provider_id: body.provider_id,
      scopes: body.scopes,
      code_verifier: codeVerifier,
    }
    await fastify.redis.set(`${OAUTH_STATE_KEY_PREFIX}${state}`, JSON.stringify(stateBody), 'EX', OAUTH_STATE_TTL_SECONDS)

    for (const [key, value] of Object.entries(recordConfig(config, 'authorization_params'))) {
      authorizationUrl.searchParams.set(key, value)
    }
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('client_id', clientId)
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('state', state)
    const providerScopes = stringListConfig(config, 'scopes')
    if (providerScopes.length > 0) authorizationUrl.searchParams.set('scope', providerScopes.join(' '))
    authorizationUrl.searchParams.set('code_challenge', codeChallenge(codeVerifier))
    authorizationUrl.searchParams.set('code_challenge_method', 'S256')

    return {
      authorization_url: authorizationUrl.toString(),
      state,
      expires_at: new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString(),
    }
  })

  fastify.get('/zones/:zoneId/provider-grants/oauth/callback', async (req, reply) => {
    const params = parseParams(ZoneParams, req, reply)
    if (!params) return
    const parsed = OAuthCallbackQuery.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_oauth_callback' })
    const query = parsed.data
    if (query.error) {
      return reply.code(400).send({ error: 'provider_oauth_denied', detail: query.error_description ?? query.error })
    }
    if (!query.code) return reply.code(400).send({ error: 'authorization_code_required' })
    const stateKey = `${OAUTH_STATE_KEY_PREFIX}${query.state}`
    const rawState = await fastify.redis.call('GETDEL', stateKey)
    if (typeof rawState !== 'string' || !rawState) return reply.code(400).send({ error: 'oauth_state_expired' })
    let state: z.infer<typeof OAuthStateBody>
    try {
      state = OAuthStateBody.parse(JSON.parse(rawState))
    } catch {
      return reply.code(400).send({ error: 'oauth_state_invalid' })
    }
    if (state.zone_id !== params.zoneId) return reply.code(400).send({ error: 'oauth_state_mismatch' })

    const { rows } = await fastify.db.query<ProviderOAuthRow>(
      `SELECT
         p.id, p.provider_kind, p.config_json, p.secret_config_ct, p.secret_config_nonce,
         r.scopes AS resource_scopes, r.credential_provider_id AS resource_provider_id
       FROM providers p
       LEFT JOIN resources r ON r.zone_id = p.zone_id AND r.id = $3 AND r.archived_at IS NULL
       WHERE p.zone_id = $1 AND p.id = $2 AND p.archived_at IS NULL`,
      [state.zone_id, state.provider_id, state.resource_id],
    )
    const row = rows[0]
    if (!row) return reply.code(404).send({ error: 'provider_not_found' })
    if (row.provider_kind !== 'oauth2_authorization_code') return reply.code(400).send({ error: 'provider_grant_unsupported' })
    if (!row.resource_scopes) return reply.code(404).send({ error: 'resource_not_found' })
    if (row.resource_provider_id !== state.provider_id) return reply.code(400).send({ error: 'provider_resource_mismatch' })
    if (!scopesAllowed(state.scopes, row.resource_scopes)) return reply.code(403).send({ error: 'grant_scopes_exceed_resource' })

    const config = row.config_json
    const secretConfig = openProviderSecretConfig(row)
    const clientId = stringConfig(config, 'client_id')
    const clientAuthMethod = stringConfig(config, 'client_auth_method') || 'client_secret_basic'
    const clientSecret = secretConfig.client_secret ?? ''
    if (!clientId || (clientAuthMethod !== 'none' && !clientSecret)) {
      return reply.code(400).send({ error: 'invalid_provider_config' })
    }
    let tokenEndpoint: URL
    try {
      tokenEndpoint = ensureAllowedTokenEndpoint(stringConfig(config, 'token_endpoint'), stringListConfig(config, 'allowed_token_hosts'))
    } catch (err) {
      return reply.code(400).send({ error: 'provider_token_endpoint_not_allowed', detail: err instanceof Error ? err.message : String(err) })
    }

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code: query.code,
      redirect_uri: stringConfig(config, 'redirect_uri'),
      code_verifier: state.code_verifier,
    })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROVIDER_TOKEN_EXCHANGE_TIMEOUT_MS)
    let tokenResponse: Response
    try {
      tokenResponse = await fetch(tokenEndpoint, { ...buildTokenRequest(form, clientId, clientSecret, clientAuthMethod), signal: controller.signal })
    } catch (err) {
      req.log.warn({ err, providerId: state.provider_id }, 'provider OAuth token exchange failed')
      return reply.code(502).send({ error: 'provider_token_exchange_failed' })
    } finally {
      clearTimeout(timer)
    }
    if (!tokenResponse.ok) {
      req.log.warn({ statusCode: tokenResponse.status, providerId: state.provider_id }, 'provider OAuth token exchange failed')
      return reply.code(502).send({ error: 'provider_token_exchange_failed' })
    }
    let tokenJson: Record<string, unknown>
    try {
      tokenJson = await tokenResponse.json() as Record<string, unknown>
    } catch {
      return reply.code(502).send({ error: 'provider_token_response_invalid' })
    }
    const accessToken = typeof tokenJson.access_token === 'string' ? tokenJson.access_token : ''
    const refreshToken = typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : ''
    const expiresIn = typeof tokenJson.expires_in === 'number' && Number.isFinite(tokenJson.expires_in) ? tokenJson.expires_in : 0
    if (!accessToken) return reply.code(502).send({ error: 'provider_token_response_invalid' })

    const grantId = uuidv7()
    const accessTokenCt = sealText(accessToken)
    const refreshTokenCt = refreshToken ? sealText(refreshToken) : null
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
    const { rows: grantRows } = await fastify.db.query<Record<string, unknown>>(
      `INSERT INTO provider_grants (id, zone_id, user_id, resource_id, provider_id, scopes,
                                   access_token_ct, refresh_token_ct, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, zone_id, user_id, resource_id, provider_id, scopes, status, expires_at, created_at`,
      [grantId, state.zone_id, state.user_id, state.resource_id, state.provider_id, state.scopes, accessTokenCt, refreshTokenCt, expiresAt],
    )
    return reply.code(201).send(grantRows[0] ?? {})
  })

  fastify.delete('/zones/:zoneId/grants/:id', async (req, reply) => {
    const params = parseParams(ZoneIdParams, req, reply)
    if (!params) return
    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ user_id: string }>(
        `UPDATE delegated_grants SET status = 'revoked'
         WHERE id = $1 AND zone_id = $2
         RETURNING user_id`,
        [params.id, params.zoneId],
      )
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'grant_not_found' })
      }

      // Page session revocation so a grant covering many active sessions cannot
      // hold a long-running UPDATE lock or flood the outbox in a single batch.
      while (true) {
        const { rows: sessions } = await client.query<{ id: string }>(
          `UPDATE sessions SET status = 'revoked'
           WHERE id IN (
             SELECT id FROM sessions
             WHERE zone_id = $1 AND status = 'active' AND subject_id = $2
             ORDER BY created_at
             LIMIT $3
             FOR UPDATE SKIP LOCKED
           )
           RETURNING id`,
          [params.zoneId, rows[0].user_id, SESSION_REVOKE_BATCH],
        )
        for (const s of sessions) {
          await enqueueOutbox(client, {
            streamName: STREAM_SESSIONS_REVOKE,
            payload: { zone_id: params.zoneId, session_id: s.id, reason: 'grant_revoked', grant_id: params.id },
            requestId: req.id,
          })
        }
        if (sessions.length < SESSION_REVOKE_BATCH) break
      }

      await client.query('COMMIT')
      return reply.code(204).send()
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })
}
