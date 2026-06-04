/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Build-time generator for the /llms.txt AI discovery file.
 */

import { getCollection } from 'astro:content'

const site = 'https://docs.caracal.run'

const sections: Record<string, string[]> = {
  'Get Started': [
    'get-started',
    'get-started/install-caracal',
    'get-started/first-protected-call',
    'get-started/add-sdk-to-your-app',
    'get-started/first-run-troubleshooting',
  ],
  'Tutorials': [
    'tutorials',
    'tutorials/protect-an-api',
    'tutorials/connect-an-agent',
    'tutorials/inspect-a-run',
    'tutorials/choose-production-path',
  ],
  'Guides': [
    'guides',
    'guides/modeling-recipes',
    'guides/resources-providers',
    'guides/provider-recipes',
    'guides/author-policy',
    'guides/activate-policy-set',
    'guides/authorize-access',
    'guides/sdk-typescript',
    'guides/sdk-python',
    'guides/sdk-go',
    'guides/runtime-run',
    'guides/protect-gateway-http',
    'guides/protect-express',
    'guides/protect-fastmcp',
    'guides/protect-nethttp',
    'guides/protect-mcp',
    'guides/audit-stream',
    'guides/delegation',
    'guides/step-up',
    'guides/enterprise-runtime-patterns',
  ],
  'Core Concepts': [
    'concepts',
    'concepts/model-overview',
    'concepts/authority-model',
    'concepts/zone',
    'concepts/principal',
    'concepts/resource-grant',
    'concepts/policy',
    'concepts/step-up',
    'concepts/mandate',
    'concepts/delegation',
    'concepts/constraint',
    'concepts/sessions-revocation',
    'concepts/audit-ledger',
  ],
  'Operations': [
    'operations',
    'operations/docker-compose',
    'operations/kubernetes-helm',
    'operations/cloud-native-profiles',
    'operations/cloud-reference-deployments',
    'operations/enterprise-install-kit',
    'operations/env-vars',
    'operations/tls-hardening',
    'operations/key-management',
    'operations/postgres',
    'operations/redis',
    'operations/scale-capacity',
    'operations/observability',
    'operations/alerts',
    'operations/troubleshooting',
    'operations/debugging',
    'operations/failure-modes',
    'operations/failure-drills',
    'operations/backup-retention',
    'operations/incident-response',
    'operations/platform-rollout-kit',
    'operations/policy-deployment',
    'operations/upgrade',
    'operations/compliance-audit-integration',
    'operations/platform-team-handoff',
  ],
  'Architecture': [
    'architecture',
    'architecture/system-topology',
    'architecture/token-exchange-flow',
    'architecture/delegation-flow',
    'architecture/event-streams',
    'architecture/storage-model',
    'architecture/crypto-keys',
    'architecture/trust-boundaries',
  ],
  'Runtime and Console': [
    'runtime-console',
    'runtime-console/cli-and-console',
    'runtime-console/stack',
    'runtime-console/console',
    'runtime-console/config-file',
    'runtime-console/runtime',
    'runtime-console/admin',
    'runtime-console/observability',
    'runtime-console/agents',
  ],
  'SDKs': [
    'sdks',
    'sdks/typescript',
    'sdks/python',
    'sdks/go',
    'sdks/verification-layer',
    'sdks/connectors',
    'sdks/connectors/express',
    'sdks/connectors/fastmcp',
    'sdks/connectors/nethttp',
    'sdks/transport-mcp',
    'sdks/identity',
    'sdks/revocation',
    'sdks/oauth',
    'sdks/transport-a2a',
    'sdks/admin',
    'sdks/connectors/redis',
    'sdks/connectors/postgres',
  ],
  'API Reference': ['api', 'api/control-plane', 'api/coordinator', 'api/sts', 'api/gateway', 'api/event-topics'],
  'Security': ['security', 'security/threat-model', 'security/hardening', 'security/disclosure'],
  'Reference': ['reference', 'enterprise', 'reference/glossary', 'reference/errors', 'reference/configuration', 'reference/config-precedence', 'reference/defaults-and-limits', 'reference/compatibility'],
  'Contributing': ['contributing', 'contributing/setup', 'contributing/workflow', 'contributing/testing', 'contributing/release', 'contributing/governance'],
}

export async function GET() {
  const docs = await getCollection('docs')
  const byId = new Map(docs.map((d) => [d.id, d]))

  const lines: string[] = [
    '# Caracal',
    '',
    '> Pre-execution authority enforcement for AI agents. Policies, mandates, and audit for production-grade autonomous systems.',
    '',
    'Caracal is an open-source system built by Garudex Labs. It issues short-lived signed mandates that bind agents and workloads to policy before protected-resource access. The core primitives are: principal, mandate, policy, zone, resource, grant, delegation edge, constraint, agent session, step-up challenge, and audit ledger.',
    '',
    'The runtime includes API (port 3000), STS (port 8080), Gateway (port 8081), Audit (port 9090), Coordinator (port 4000), and optional Control (port 8087). Runtime lifecycle uses the top-level caracal runtime CLI; product management uses Console, Admin SDK, or Control API.',
    '',
  ]

  for (const [sectionTitle, ids] of Object.entries(sections)) {
    const entries: string[] = []
    for (const id of ids) {
      const doc = byId.get(id)
      if (!doc) continue
      entries.push(`- [${doc.data.title}](${site}/${id}/): ${doc.data.description}`)
    }
    if (entries.length === 0) continue
    lines.push(`## ${sectionTitle}`)
    lines.push(...entries)
    lines.push('')
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
