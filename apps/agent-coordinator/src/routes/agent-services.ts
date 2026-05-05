// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent service registration, discovery, and heartbeat routes.

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'

const ServiceBody = z.object({
  application_id: z.string().min(1),
  endpoint_url: z.string().url(),
  protocol_versions: z.array(z.string().min(1)).default([]),
  framework: z.object({
    name: z.string().min(1),
    version: z.string().optional(),
  }).optional(),
  capabilities: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).default({}),
})

const HeartbeatBody = z.object({
  service_id: z.string().min(1).optional(),
  status: z.enum(['starting', 'healthy', 'degraded', 'unhealthy']).default('healthy'),
  active_invocations: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).default({}),
})

export const agentServicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/zones/:zoneId/agent-services', async (req, reply) => {
    const { zoneId } = req.params as { zoneId: string }
    const body = ServiceBody.parse(req.body)
    const { rows: applications } = await fastify.db.query(
      `SELECT 1 FROM applications
       WHERE id = $1 AND zone_id = $2 AND archived_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())`,
      [body.application_id, zoneId],
    )
    if (!applications[0]) return reply.code(404).send({ error: 'application_not_found' })
    const id = uuidv7()
    const { rows } = await fastify.db.query(
      `INSERT INTO agent_services
       (id, zone_id, application_id, endpoint_url, protocol_versions, framework_name, framework_version,
        capabilities, health, metadata_json, last_heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'starting',$9,now())
       ON CONFLICT (zone_id, application_id, endpoint_url)
       DO UPDATE SET protocol_versions = EXCLUDED.protocol_versions,
                     framework_name = EXCLUDED.framework_name,
                     framework_version = EXCLUDED.framework_version,
                     capabilities = EXCLUDED.capabilities,
                     metadata_json = EXCLUDED.metadata_json,
                     updated_at = now()
       RETURNING id, zone_id, application_id, endpoint_url, protocol_versions,
                 framework_name, framework_version, capabilities, health, metadata_json, last_heartbeat_at`,
      [
        id,
        zoneId,
        body.application_id,
        body.endpoint_url,
        body.protocol_versions,
        body.framework?.name ?? null,
        body.framework?.version ?? null,
        body.capabilities,
        body.metadata,
      ],
    )
    return reply.code(201).send(rows[0])
  })

  fastify.get('/zones/:zoneId/agent-services', async (req) => {
    const { zoneId } = req.params as { zoneId: string }
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, application_id, endpoint_url, protocol_versions,
              framework_name, framework_version, capabilities, health, metadata_json, last_heartbeat_at
       FROM agent_services
       WHERE zone_id = $1
       ORDER BY last_heartbeat_at DESC NULLS LAST, created_at DESC`,
      [zoneId],
    )
    return rows
  })

  fastify.post('/agents/:id/heartbeat', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = HeartbeatBody.parse(req.body)
    const { rows: agents } = await fastify.db.query(
      `UPDATE agent_sessions SET last_active_at = now()
       WHERE id = $1 AND status IN ('active', 'suspended')
       RETURNING id, zone_id, application_id, last_active_at`,
      [id],
    )
    if (!agents[0]) return reply.code(404).send({ error: 'agent_not_found' })

    let service = null
    if (body.service_id) {
      const { rows } = await fastify.db.query(
        `UPDATE agent_services
         SET health = $1, metadata_json = $2, last_heartbeat_at = now(), updated_at = now()
         WHERE id = $3 AND zone_id = $4
         RETURNING id, zone_id, application_id, endpoint_url, protocol_versions,
                   framework_name, framework_version, capabilities, health, metadata_json, last_heartbeat_at`,
        [body.status, body.metadata, body.service_id, agents[0].zone_id],
      )
      if (!rows[0]) return reply.code(404).send({ error: 'agent_service_not_found' })
      service = rows[0]
    }

    return {
      agent: agents[0],
      service,
      active_invocations: body.active_invocations,
    }
  })
}
