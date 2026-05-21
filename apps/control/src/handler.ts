// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// /v1/control/invoke handler: rate-limits, authenticates, blocks JTI replay, and dispatches through the shared engine.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { dispatch, DispatchError, type DispatchContext, type FlagMap, type Principal } from '@caracalai/engine'
import { Authenticator, AuthError } from './auth.js'
import { newRequestId, type EventSink } from './audit.js'
import type { Replay } from './replay.js'
import type { RateLimiter } from './ratelimit.js'
import type { ControlGate } from './gate.js'

const MAX_BODY_BYTES = 64 * 1024

interface InvokeBody {
  command?: unknown
  subcommand?: unknown
  flags?: unknown
}

interface RouteRateLimit {
  readonly max: number
  readonly timeWindow: number
}

export interface InvokeDeps {
  auth: Authenticator
  replay: Replay
  rate: RateLimiter
  routeRateLimit: RouteRateLimit
  sink: EventSink
  ctx: DispatchContext
  gate: ControlGate
}

export function registerInvokeRoute(app: FastifyInstance, deps: InvokeDeps): void {
  app.post('/v1/control/invoke', {
    bodyLimit: MAX_BODY_BYTES,
    config: { rawBody: false, rateLimit: deps.routeRateLimit },
  }, (req, reply) => handle(req, reply, deps))
}

async function handle(req: FastifyRequest, reply: FastifyReply, deps: InvokeDeps): Promise<void> {
  const requestId = newRequestId()
  reply.header('x-request-id', requestId)
  if (!deps.gate.enabled()) {
    await deps.sink.emit({
      at: new Date(), subject: 'anonymous', jti: '',
      decision: 'deny', reason: 'control disabled', requestId,
    })
    return reply.code(503).send({ error: 'control disabled' })
  }

  let claims
  try {
    claims = await deps.auth.verify(req.headers.authorization)
  } catch (err) {
    await deps.sink.emit({
      at: new Date(), subject: 'anonymous', jti: '',
      decision: 'deny', reason: 'auth: ' + describe(err), requestId,
    })
    return reply.code(401).send({ error: 'unauthorized' })
  }

  if (!(await deps.replay.mark(claims.jti, claims.exp))) {
    await deps.sink.emit({
      at: new Date(), zoneId: claims.zoneId, clientId: claims.clientId,
      subject: claims.sub, jti: claims.jti, decision: 'deny', reason: 'replay', requestId,
    })
    return reply.code(401).send({ error: 'token replay' })
  }
  if (!deps.rate.allow(claims.sub)) {
    await deps.sink.emit({
      at: new Date(), zoneId: claims.zoneId, clientId: claims.clientId,
      subject: claims.sub, jti: claims.jti, decision: 'deny', reason: 'rate limited', requestId,
    })
    return reply.code(429).send({ error: 'rate limited' })
  }

  const body = req.body as InvokeBody | null
  const command = typeof body?.command === 'string' ? body.command : ''
  const subcommand = typeof body?.subcommand === 'string' ? body.subcommand : ''
  const flags = (body?.flags && typeof body.flags === 'object' && !Array.isArray(body.flags))
    ? body.flags as FlagMap
    : undefined

  const principal: Principal = {
    kind: 'remote',
    subject: claims.sub,
    zoneId: claims.zoneId,
    clientId: claims.clientId,
    scopes: claims.scope.split(/\s+/).filter((s) => s.length > 0),
  }

  try {
    const result = await dispatch({ command, subcommand, flags }, principal, deps.ctx)
    await deps.sink.emit({
      at: new Date(), zoneId: claims.zoneId, clientId: claims.clientId,
      subject: claims.sub, jti: claims.jti, command, subcommand,
      decision: 'allow', requestId,
    })
    return reply.code(200).send({ ok: true, result })
  } catch (err) {
    const reason = describe(err)
    await deps.sink.emit({
      at: new Date(), zoneId: claims.zoneId, clientId: claims.clientId,
      subject: claims.sub, jti: claims.jti, command, subcommand,
      decision: 'deny', reason, requestId,
    })
    if (err instanceof DispatchError) {
      if (err.code === 'denied') return reply.code(403).send({ error: 'denied' })
      if (err.code === 'invalid') return reply.code(400).send({ error: 'invalid request' })
      return reply.code(501).send({ error: 'unsupported' })
    }
    req.log.error({ command }, 'upstream error: ' + reason)
    return reply.code(502).send({ error: 'upstream error' })
  }
}

function describe(err: unknown): string {
  if (err instanceof AuthError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}
