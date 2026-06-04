/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Build-time generator for the /llms-full.txt complete content file.
 */

import { getCollection } from 'astro:content'

const site = 'https://docs.caracal.run'

// Reader order: onboarding first, then tutorials, guides, concepts, and reference material.
const pageOrder = [
  'get-started',
  'get-started/install-caracal',
  'get-started/first-protected-call',
  'get-started/add-sdk-to-your-app',
  'get-started/first-run-troubleshooting',
  'tutorials',
  'tutorials/protect-an-api',
  'tutorials/connect-an-agent',
  'tutorials/inspect-a-run',
  'tutorials/choose-production-path',
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
  'concepts',
  'concepts/model-overview',
  'concepts/authority-model',
  'concepts/principal',
  'concepts/policy',
  'concepts/mandate',
  'concepts/zone',
  'concepts/resource-grant',
  'concepts/delegation',
  'concepts/constraint',
  'concepts/sessions-revocation',
  'concepts/audit-ledger',
  'concepts/step-up',
  'architecture',
  'architecture/system-topology',
  'architecture/token-exchange-flow',
  'architecture/delegation-flow',
  'architecture/event-streams',
  'architecture/storage-model',
  'architecture/crypto-keys',
  'architecture/trust-boundaries',
  'runtime-console',
  'runtime-console/cli-and-console',
  'runtime-console/config-file',
  'runtime-console/runtime',
  'runtime-console/stack',
  'runtime-console/observability',
  'runtime-console/agents',
  'sdks',
  'sdks/typescript',
  'sdks/python',
  'sdks/go',
  'sdks/identity',
  'sdks/oauth',
  'sdks/revocation',
  'sdks/admin',
  'sdks/transport-mcp',
  'sdks/transport-a2a',
  'sdks/connectors',
  'security/threat-model',
  'security/hardening',
  'security/disclosure',
  'api',
  'api/control-plane',
  'api/coordinator',
  'api/sts',
  'api/gateway',
  'api/event-topics',
  'reference',
  'reference/errors',
  'reference/glossary',
  'reference/configuration',
  'reference/config-precedence',
  'reference/defaults-and-limits',
  'reference/compatibility',
  'contributing/setup',
  'contributing/workflow',
  'contributing/style',
]

export async function GET() {
  const docs = await getCollection('docs')
  const byId = new Map(docs.map((d) => [d.id, d]))

  const header = [
    '# Caracal',
    '',
    '> Pre-execution authority enforcement for AI agents. Policies, mandates, and audit for production-grade autonomous systems.',
    '',
    'Caracal is an open-source system built by Garudex Labs. It issues short-lived signed mandates that bind agents and workloads to policy before protected-resource access.',
    '',
    '---',
    '',
  ]

  const pages: string[] = []

  // Ordered pages first
  const seen = new Set<string>()
  for (const id of pageOrder) {
    const doc = byId.get(id)
    if (!doc) continue
    seen.add(id)
    pages.push(formatPage(doc, site))
  }

  // Any remaining pages not in the explicit order
  for (const doc of docs) {
    if (seen.has(doc.id)) continue
    if (doc.id === 'index') continue
    pages.push(formatPage(doc, site))
  }

  return new Response([...header, ...pages].join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function formatPage(doc: Awaited<ReturnType<typeof getCollection<'docs'>>>[number], base: string) {
  const d = doc.data as Record<string, unknown>
  const lines = [
    '---',
    `# ${doc.data.title}`,
    `# URL: ${base}/${doc.id}/`,
    `# Type: ${(d.pageType as string | undefined) ?? 'page'}`,
    `# Concepts: ${((d.concepts as string[] | undefined) ?? []).join(', ')}`,
    `# Requires: ${((d.requires as string[] | undefined) ?? []).join(', ')}`,
    '---',
    '',
    doc.body ?? '',
    '',
  ]
  return lines.join('\n')
}
