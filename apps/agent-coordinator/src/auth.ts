// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JWT bearer verification against STS JWKS endpoint.

import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { cfg } from './config.js'

const JWKS = createRemoteJWKSet(new URL(`${cfg.stsUrl}/.well-known/jwks.json`))

declare module 'fastify' {
  interface FastifyRequest {
    caracalAuth?: {
      zoneId: string
      scopes: string[]
    }
  }
}

export async function verifyBearer(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.url === '/health') return

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'missing_token' })
    return
  }
  const token = auth.slice(7)
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: cfg.issuerUrl,
      audience: cfg.audience,
      algorithms: ['ES256'],
    })
    const scopes = typeof payload.scope === 'string' ? payload.scope.split(/\s+/) : []
    if (!scopes.includes(cfg.requiredScope)) {
      reply.code(403).send({ error: 'missing_scope' })
      return
    }
    const zoneId = payload['zone_id']
    if (typeof zoneId !== 'string' || zoneId === '') {
      reply.code(401).send({ error: 'invalid_token' })
      return
    }
    const params = req.params as { zoneId?: string } | undefined
    if (params?.zoneId && params.zoneId !== zoneId) {
      reply.code(403).send({ error: 'zone_mismatch' })
      return
    }
    req.caracalAuth = { zoneId, scopes }
  } catch {
    reply.code(401).send({ error: 'invalid_token' })
  }
}
