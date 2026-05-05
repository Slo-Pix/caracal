// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Zone audit and session read routes for management clients.

import type { FastifyPluginAsync } from 'fastify'

export const zoneEventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/zones/:zoneId/audit', async (req) => {
    const { zoneId } = req.params as { zoneId: string }
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, event_type, request_id, decision, evaluation_status,
              metadata_json, occurred_at, ingested_at
       FROM audit_events
       WHERE zone_id = $1
       ORDER BY occurred_at DESC
       LIMIT 100`,
      [zoneId],
    )
    return rows
  })

  fastify.get('/zones/:zoneId/sessions', async (req) => {
    const { zoneId } = req.params as { zoneId: string }
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, session_type, subject_id, parent_id, status, expires_at,
              authenticated_at, created_at
       FROM sessions
       WHERE zone_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [zoneId],
    )
    return rows
  })
}
