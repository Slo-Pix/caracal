// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Express middleware that validates Caracal JWTs at every MCP tool boundary.

import { jwtVerify } from 'jose'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { getKeySet } from './jwks.js'

export interface MiddlewareOptions {
  issuer: string
  audience: string
  zoneId?: string
  requiredScopes?: string[]
}

export interface CaracalRequest extends Request {
  caracalClaims?: {
    sub: string
    zoneId: string
    scope: string
  }
}

export function caracalAuth(opts: MiddlewareOptions): RequestHandler {
  return async (req: CaracalRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'invalid_token', error_description: 'Missing bearer token' })
      return
    }

    const token = authHeader.slice(7)
    try {
      const keySet = await getKeySet(opts.issuer)
      const { payload } = await jwtVerify(token, keySet, {
        issuer: opts.issuer,
        audience: opts.audience,
      })

      const scope = (payload['scope'] as string | undefined) ?? ''
      const zoneId = payload['zone_id']
      if (typeof zoneId !== 'string' || zoneId === '' || (opts.zoneId && zoneId !== opts.zoneId)) {
        res.status(401).json({ error: 'invalid_token', error_description: 'Token zone validation failed' })
        return
      }
      for (const required of opts.requiredScopes ?? []) {
        if (!scope.split(' ').includes(required)) {
          res.status(403).json({ error: 'insufficient_scope', error_description: `Missing scope: ${required}` })
          return
        }
      }

      req.caracalClaims = { sub: payload.sub ?? '', zoneId, scope }
      next()
    } catch {
      res.status(401).json({ error: 'invalid_token', error_description: 'Token validation failed' })
    }
  }
}
