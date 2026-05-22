// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// End-to-end CLI command tests using a stubbed fetch and admin token env.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditCommand, explainCommand } from '../../../../apps/cli/src/commands/audit.ts'
import { debugCommand } from '../../../../apps/cli/src/commands/debug.ts'
import { zoneCommand } from '../../../../apps/cli/src/commands/zone.ts'
import { agentCommand, delegationCommand } from '../../../../apps/cli/src/commands/agent.ts'
import { policyCommand, policySetCommand } from '../../../../apps/cli/src/commands/policy.ts'
import { doctorCommand } from '../../../../apps/cli/src/commands/doctor.ts'
import { manifestCommand } from '../../../../apps/cli/src/commands/manifest.ts'
import { runPreflightChecks } from '@caracalai/engine'

const ORIG_ENV = { ...process.env }

function stubFetch(handler: (url: string, init: RequestInit) => unknown): ReturnType<typeof vi.fn> {
  const f = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    const body = handler(url, init)
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(body),
      json: async () => body,
    }
  })
  vi.stubGlobal('fetch', f)
  return f
}

describe('CLI commands (e2e against stubbed fetch)', () => {
  let stdout: ReturnType<typeof vi.spyOn>
  let stderr: ReturnType<typeof vi.spyOn>
  let exit: ReturnType<typeof vi.spyOn>
  let tempDirs: string[]

  beforeEach(() => {
    tempDirs = []
    const home = mkdtempSync(join(tmpdir(), 'caracal-test-home-'))
    tempDirs.push(home)
    process.env = { ...ORIG_ENV, CARACAL_HOME: home, CARACAL_ADMIN_TOKEN: 'secret', CARACAL_API_URL: 'http://api', CARACAL_COORDINATOR_URL: 'http://coordinator', CARACAL_STS_URL: 'http://sts', CARACAL_ZONE_ID: 'z1' }
    delete process.env.CARACAL_COORDINATOR_TOKEN
    delete process.env.CARACAL_REPO_ROOT
    delete process.env.CARACAL_SECRETS_DIR
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    exit = vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`__exit:${c ?? 0}`) }) as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...ORIG_ENV }
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  })

  it('audit tail calls /v1/zones/:id/audit with filters and prints a table', async () => {
    const fetchMock = stubFetch((url) => {
      expect(url).toBe('http://api/v1/zones/z1/audit?decision=deny&limit=2')
      return [
        { id: 'a1', occurred_at: '2026-01-01T00:00:00Z', event_type: 'token.exchange', decision: 'deny', evaluation_status: 'evaluated', request_id: 'r1' },
        { id: 'a2', occurred_at: '2026-01-01T00:00:01Z', event_type: 'token.exchange', decision: 'deny', evaluation_status: 'evaluated', request_id: 'r2' },
      ]
    })
    await auditCommand(['tail', '--decision', 'deny', '--limit', '2'])
    expect(fetchMock).toHaveBeenCalledOnce()
    const written = stdout.mock.calls.map((c) => c[0]).join('')
    expect(written).toContain('event_type')
    expect(written).toContain('a1')
    expect(written).toContain('a2')
    expect(exit).not.toHaveBeenCalled()
  })

  it('audit tail --json emits machine-readable output', async () => {
    stubFetch(() => [{ id: 'a1', occurred_at: 't', event_type: 'e', decision: 'allow', evaluation_status: 'evaluated', request_id: 'r' }])
    await auditCommand(['tail', '--json'])
    const written = stdout.mock.calls.map((c) => c[0]).join('')
    expect(JSON.parse(written)).toEqual([
      { id: 'a1', occurred_at: 't', event_type: 'e', decision: 'allow', evaluation_status: 'evaluated', request_id: 'r' },
    ])
  })

  it('explain prints determining policies and diagnostics', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://api/v1/zones/z1/audit/by-request/req-7')
      return [{
        id: 'a9',
        event_type: 'token.exchange',
        decision: 'deny',
        evaluation_status: 'evaluated',
        occurred_at: '2026-01-01T00:00:00Z',
        request_id: 'req-7',
        policy_set_id: 'ps-1',
        policy_set_version_id: 'psv-2',
        manifest_sha: 'sha-3',
        determining_policies_json: [{ policy_id: 'p1', effect: 'deny' }],
        diagnostics_json: [{ rule: 'mfa_required' }],
        metadata_json: {
          user_agent: 'curl',
          application_id: 'app-1',
          session_id: 'sid-1',
          agent_session_id: 'agent-1',
          delegation_edge_id: 'edge-1',
          resource: 'resource://calendar',
          requested_scopes: ['calendar:read'],
          provider_id: 'provider-1',
          grant_id: 'grant-1',
          auth_mode: 'provider_oauth',
        },
      }]
    })
    await explainCommand(['req-7'])
    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('determining_policies')
    expect(out).toContain('mfa_required')
    expect(out).toContain('authority:')
    expect(out).toContain('authority_session      sid-1')
    expect(out).toContain('provider               provider-1 grant=grant-1 auth=provider_oauth')
    expect(out).toContain('user_agent')
  })

  it('explain renders a Mermaid authority flow', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://api/v1/zones/z1/audit/by-request/req-7')
      return [{
        id: 'a9',
        event_type: 'token.exchange',
        decision: 'allow',
        evaluation_status: 'complete',
        occurred_at: '2026-01-01T00:00:00Z',
        request_id: 'req-7',
        policy_set_id: 'ps-1',
        policy_set_version_id: 'psv-2',
        manifest_sha: 'sha-3',
        determining_policies_json: [{ policy_id: 'p1', effect: 'allow' }],
        diagnostics_json: [],
        metadata_json: {
          application_id: 'app-1',
          session_id: 'sid-1',
          agent_session_id: 'agent-1',
          delegation_edge_id: 'edge-1',
          resource: 'resource://calendar',
          requested_scopes: ['calendar:read'],
          provider_id: 'provider-1',
          grant_id: 'grant-1',
          auth_mode: 'provider_oauth',
        },
      }]
    })

    await explainCommand(['req-7', '--flow'])

    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('flowchart LR')
    expect(out).toContain('Agent app<br/>app-1')
    expect(out).toContain('Delegated permission<br/>edge-1')
    expect(out).toContain('Gateway provider<br/>provider-1')
    expect(out).toContain('Policy set<br/>ps-1')
  })

  it('explain requires a request id', async () => {
    await expect(explainCommand([])).rejects.toThrow(/__exit:1/)
    expect(stderr).toHaveBeenCalled()
  })

  it('debug request prints a decision trace', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://api/v1/zones/z1/audit/by-request/req-7/explain')
      return {
        request_id: 'req-7',
        zone_id: 'z1',
        final_decision: 'deny',
        denied: [{
          event_id: 'a9',
          event_type: 'token.exchange',
          evaluation_status: 'complete',
          determining_policies: [{ policy_id: 'p1', effect: 'deny' }],
          diagnostics: [{ rule: 'mfa_required', message: 'MFA step-up required' }],
          metadata: { application_id: 'app-1' },
        }],
        events: [{
          id: 'a9',
          event_type: 'token.exchange',
          decision: 'deny',
          evaluation_status: 'complete',
          occurred_at: '2026-01-01T00:00:00Z',
          request_id: 'req-7',
          policy_set_id: 'ps-1',
          policy_set_version_id: 'psv-2',
          manifest_sha: 'sha-3',
          determining_policies_json: [{ policy_id: 'p1', effect: 'deny' }],
          diagnostics_json: [{ rule: 'mfa_required', message: 'MFA step-up required' }],
          metadata_json: { application_id: 'app-1' },
        }],
      }
    })

    await debugCommand(['request', 'req-7'])

    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('final_decision deny')
    expect(out).toContain('failure_reasons')
    expect(out).toContain('rule=mfa_required')
    expect(out).toContain('message=MFA step-up required')
    expect(out).toContain('policy_set    ps-1 version=psv-2 sha=sha-3')
  })

  it('zone list pretty-prints a table', async () => {
    stubFetch(() => [{ id: 'z1', slug: 'demo', display_name: 'Demo', status: 'active', created_at: 't' }])
    await zoneCommand(['list'])
    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('id')
    expect(out).toContain('z1')
  })

  it('agent list refuses to run without coordinator token', async () => {
    await expect(agentCommand(['list'])).rejects.toThrow(/__exit:1/)
    expect(stderr.mock.calls.map((c) => c[0]).join('')).toContain('CARACAL_COORDINATOR_TOKEN')
  })

  it('delegation help prints delegation commands', async () => {
    process.env.CARACAL_COORDINATOR_TOKEN = 'coordinator-token'
    await expect(delegationCommand(['help'])).rejects.toThrow(/__exit:0/)
    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('Usage: caracal delegation')
    expect(out).toContain('inbound <session-id>')
    expect(out).not.toContain('Usage: caracal agent')
  })

  it('policy validate posts Rego to the validation endpoint', async () => {
    stubFetch((url, init) => {
      expect(url).toBe('http://api/v1/policies/validate')
      expect(init.method).toBe('POST')
      expect(JSON.parse(String(init.body))).toEqual({
        content: 'package caracal.authz\nresult := {}',
        schema_version: '2026-05-20',
      })
      return {
        valid: true,
        schema_version: '2026-05-20',
        input_schema_version: '2026-05-20',
        output_contract: { package: 'caracal.authz', rule: 'result', decision: ['allow', 'deny'], evaluation_status: ['complete'] },
        warnings: [],
      }
    })

    await policyCommand(['validate', '--content', 'package caracal.authz\nresult := {}', '--schema-version', '2026-05-20'])

    expect(JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))).toMatchObject({ valid: true })
  })

  it('policy help exposes only production policy verbs', async () => {
    await expect(policyCommand(['help'])).rejects.toThrow('__exit:0')
    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('validate')
    expect(out).toContain('version <id>')
    expect(out).not.toContain('sample-input')
    expect(out).not.toContain('template')
  })

  it('manifest validate accepts Gateway upstream manifests offline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'caracal-manifest-'))
    const file = join(dir, 'gateway.json')
    writeFileSync(file, JSON.stringify({
      schema_version: '2026-05-21',
      name: 'calendar-api',
      version: '1.0.0',
      resource_identifier: 'resource://calendar',
      protocols: ['http/1.1'],
      auth_modes: ['caracal_jwt'],
      scopes: ['calendar:read'],
      identity_forwarding: 'never',
      required_headers: ['authorization', 'traceparent', 'baggage'],
      health: { path: '/healthz', success_status: 200 },
      audit: { action_result_required: true, metadata_fields: [] },
      conformance: { fixture_url: 'https://docs.caracal.run/schemas/caracal-gateway-upstream-manifest-2026-05-21.schema.json', tested_with_caracal: '0.1.2' },
    }))

    await manifestCommand(['validate', '--file', file, '--json'])

    expect(JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))).toMatchObject({
      valid: true,
      kind: 'gateway-upstream',
      schema_url: 'https://docs.caracal.run/schemas/caracal-gateway-upstream-manifest-2026-05-21.schema.json',
      errors: [],
    })
  })

  it('manifest validate rejects provider plugins that expose credentials outside Gateway', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'caracal-manifest-'))
    const file = join(dir, 'provider.json')
    writeFileSync(file, JSON.stringify({
      schema_version: '2026-05-21',
      name: 'unsafe-provider',
      version: '1.0.0',
      provider_kinds: ['oauth2'],
      config_schema: { type: 'object' },
      secret_schema: { type: 'object' },
      lifecycle: { hooks: ['validate', 'resolve'] },
      audit_metadata: { fields: [] },
      execution: { isolation: 'external_service', credential_exposure: 'agent_visible' },
    }))

    await manifestCommand(['validate', '--file', file, '--json'])

    expect(JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))).toMatchObject({
      valid: false,
      kind: 'provider-credential-plugin',
      errors: ['execution.credential_exposure must be gateway_only'],
    })
  })

  it('doctor reports selected-zone full system diagnostics', async () => {
    stubFetch((url) => {
      if (url === 'http://api/health') return { ok: true }
      if (url === 'http://api/v1/zones') return [{ id: 'z1', name: 'Local', slug: 'local' }]
      if (url === 'http://api/v1/zones/z1') return { id: 'z1', name: 'Local', slug: 'local' }
      if (url === 'http://api/v1/zones/z1/resources') return [{ id: 'res-1' }]
      if (url === 'http://api/v1/zones/z1/policy-sets') return [{ id: 'pset-1', active_version_id: 'psver-1' }]
      if (url === 'http://api/v1/zones/z1/grants') return [{ id: 'grant-1' }]
      if (url === 'http://api/v1/zones/z1/audit?limit=1') return []
      if (url.endsWith('/ready')) return { ready: true }
      if (url === 'http://sts/metrics.json') return { opa: { compile_errors: 0, eval_errors: 0, max_policy_age_seconds: 1 } }
      if (url === 'http://localhost:8081/metrics.json') return { bindings_loaded: 3, revocations_active: 1, requests_denied: 2 }
      if (url === 'http://localhost:9090/metrics.json') return { consumer_lag: 0, dlq_size: 0, tamper_mismatch_total: 0 }
      if (url === 'http://coordinator/stats') return { outbox: { pending: 0, dead: 0 }, invocations: { running: 0 } }
      throw new Error(`unexpected request ${url}`)
    })

    await expect(doctorCommand(['--zone', 'z1', '--json'])).rejects.toThrow('__exit:1')

    const body = JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))
    expect(body).toMatchObject({
      command: 'doctor',
      mode: 'system',
      context: { apiUrl: 'http://api', zoneScope: 'selected', zoneIds: ['z1'] },
    })
    expect(body.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: 'health', check: 'api health', status: 'ok' }),
      expect.objectContaining({ section: 'zones', check: 'z1 audit query', status: 'ok' }),
      expect.objectContaining({ section: 'readiness', check: 'sts metrics', status: 'ok' }),
      expect.objectContaining({ section: 'preflight', check: 'ZONE_KEK', status: 'fail' }),
    ]))
  })

  it('doctor inspects every visible zone by default', async () => {
    delete process.env.CARACAL_ZONE_ID
    const fetchMock = stubFetch((url) => {
      if (url === 'http://api/health') return { ok: true }
      if (url === 'http://api/v1/zones') return [
        { id: 'z1', name: 'Local', slug: 'local' },
        { id: 'z2', name: 'Second', slug: 'second' },
      ]
      if (url === 'http://api/v1/zones/z1') return { id: 'z1', name: 'Local', slug: 'local' }
      if (url === 'http://api/v1/zones/z2') return { id: 'z2', name: 'Second', slug: 'second' }
      if (url === 'http://api/v1/zones/z1/resources' || url === 'http://api/v1/zones/z2/resources') return []
      if (url === 'http://api/v1/zones/z1/policy-sets' || url === 'http://api/v1/zones/z2/policy-sets') return []
      if (url === 'http://api/v1/zones/z1/grants' || url === 'http://api/v1/zones/z2/grants') return []
      if (url === 'http://api/v1/zones/z1/audit?limit=1' || url === 'http://api/v1/zones/z2/audit?limit=1') return []
      if (url.endsWith('/ready')) return { ready: true }
      if (url === 'http://sts/metrics.json') return { opa: { compile_errors: 0, eval_errors: 0, max_policy_age_seconds: 1 } }
      if (url === 'http://localhost:8081/metrics.json') return { bindings_loaded: 0, revocations_active: 0, requests_denied: 0 }
      if (url === 'http://localhost:9090/metrics.json') return { consumer_lag: 0, dlq_size: 0, tamper_mismatch_total: 0 }
      if (url === 'http://coordinator/stats') return { outbox: { pending: 0, dead: 0 }, invocations: { running: 0 } }
      throw new Error(`unexpected request ${url}`)
    })

    await expect(doctorCommand(['--json'])).rejects.toThrow('__exit:1')

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      'http://api/v1/zones/z1',
      'http://api/v1/zones/z2',
      'http://api/v1/zones/z1/audit?limit=1',
      'http://api/v1/zones/z2/audit?limit=1',
    ]))
    const body = JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))
    expect(body.context).toMatchObject({ zoneScope: 'all', zoneIds: ['z1', 'z2'] })
    expect(body.checks).not.toContainEqual(expect.objectContaining({ check: 'zone selection' }))
  })

  it('doctor --ready emits strict full-system readiness state', async () => {
    delete process.env.CARACAL_ZONE_ID
    stubFetch((url) => {
      if (url === 'http://api/health') return { ok: true }
      if (url === 'http://api/v1/zones') return [{ id: 'z1', name: 'Local', slug: 'local' }]
      if (url === 'http://api/v1/zones/z1') return { id: 'z1', name: 'Local', slug: 'local' }
      if (url === 'http://api/v1/zones/z1/resources') return []
      if (url === 'http://api/v1/zones/z1/policy-sets') return []
      if (url === 'http://api/v1/zones/z1/grants') return []
      if (url === 'http://api/v1/zones/z1/audit?limit=1') return []
      if (url.endsWith('/ready')) return { ready: true }
      if (url === 'http://sts/metrics.json') return { opa: { compile_errors: 0, eval_errors: 0, max_policy_age_seconds: 1 } }
      if (url === 'http://localhost:8081/metrics.json') return { bindings_loaded: 0, revocations_active: 0, requests_denied: 0 }
      if (url === 'http://localhost:9090/metrics.json') return { consumer_lag: 0, dlq_size: 0, tamper_mismatch_total: 0 }
      if (url === 'http://coordinator/stats') return { outbox: { pending: 0, dead: 0 }, invocations: { running: 0 } }
      throw new Error(`unexpected request ${url}`)
    })

    await expect(doctorCommand(['--ready', '--json'])).rejects.toThrow('__exit:1')

    const body = JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))
    expect(body.ready).toBe(false)
    expect(body).toMatchObject({
      command: 'doctor',
      mode: 'system',
      ready: false,
      strict: true,
      summary: { fail: expect.any(Number) },
    })
    expect(body.summary.fail).toBeGreaterThan(0)
  })

  it('doctor exits nonzero when a check fails', async () => {
    delete process.env.CARACAL_ZONE_ID
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url === 'http://api/health') {
        return {
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ reason: 'booting' }),
        }
      }
      if (url === 'http://api/v1/zones') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ id: 'z1', name: 'Local', slug: 'local' }]),
          json: async () => [{ id: 'z1', name: 'Local', slug: 'local' }],
        }
      }
      throw new Error(`unexpected request ${url}`)
    }))

    await expect(doctorCommand([])).rejects.toThrow('__exit:1')

    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('api health')
    expect(out).toContain('fail')
    expect(out).toContain('HTTP 503 booting')
  })

  it('doctor skips zone-scoped checks when the selected zone is missing', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'http://api/health') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ ok: true }),
          json: async () => ({ ok: true }),
        }
      }
      if (url === 'http://api/v1/zones') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ id: 'z1', name: 'Local', slug: 'local' }]),
          json: async () => [{ id: 'z1', name: 'Local', slug: 'local' }],
        }
      }
      if (url === 'http://api/v1/zones/lfdt') {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: 'zone_not_found' }),
          json: async () => ({ error: 'zone_not_found' }),
        }
      }
      throw new Error(`unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(doctorCommand(['--zone', 'lfdt'])).rejects.toThrow('__exit:1')

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      'http://api/health',
      'http://api/v1/zones',
      'http://api/v1/zones/lfdt',
    ]))
    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('zone')
    expect(out).toContain('fail')
    expect(out).toContain('zone_not_found (HTTP 404)')
    expect(out).not.toContain('resources')
    expect(out).not.toContain('policy sets')
    expect(out).not.toContain('grants')
    expect(out).not.toContain('audit query')
  })

  it('doctor emits complete structured diagnostics by default', async () => {
    process.env.CARACAL_STS_URL = 'http://sts'
    process.env.CARACAL_GATEWAY_URL = 'http://gateway'
    process.env.CARACAL_AUDIT_URL = 'http://audit'
    stubFetch((url) => {
      if (url === 'http://api/health') return { ok: true }
      if (url === 'http://api/v1/zones') return [{ id: 'z1', name: 'Local', slug: 'local' }]
      if (url === 'http://api/v1/zones/z1') return { id: 'z1', name: 'Local', slug: 'local' }
      if (url === 'http://api/v1/zones/z1/resources') return [{ id: 'res-1' }]
      if (url === 'http://api/v1/zones/z1/policy-sets') return [{ id: 'pset-1', active_version_id: 'psver-1' }]
      if (url === 'http://api/v1/zones/z1/grants') return [{ id: 'grant-1' }]
      if (url === 'http://api/v1/zones/z1/audit?limit=1') return []
      if (url.endsWith('/ready')) return { ready: true }
      if (url === 'http://sts/metrics.json') return { opa: { compile_errors: 0, eval_errors: 0, max_policy_age_seconds: 1 } }
      if (url === 'http://gateway/metrics.json') return { bindings_loaded: 3, revocations_active: 1, requests_denied: 2 }
      if (url === 'http://audit/metrics.json') return { consumer_lag: 0, dlq_size: 0, tamper_mismatch_total: 0 }
      if (url === 'http://coordinator/stats') return { outbox: { pending: 0, dead: 0 }, invocations: { running: 0 } }
      throw new Error(`unexpected request ${url}`)
    })

    await expect(doctorCommand(['--json'])).rejects.toThrow('__exit:1')

    const body = JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))
    expect(body).toMatchObject({
      command: 'doctor',
      mode: 'system',
      context: { apiUrl: 'http://api', zoneScope: 'selected', zoneIds: ['z1'] },
    })
    expect(body.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: 'health', check: 'api health', status: 'ok' }),
      expect.objectContaining({ section: 'zones', check: 'z1 audit query', status: 'ok' }),
      expect.objectContaining({ section: 'readiness', check: 'sts metrics', status: 'ok' }),
      expect.objectContaining({ section: 'preflight', check: 'ZONE_KEK', status: 'fail' }),
    ]))
  })

  it('doctor reports service readiness and metrics in default system mode', async () => {
    process.env.CARACAL_STS_URL = 'http://sts'
    process.env.CARACAL_GATEWAY_URL = 'http://gateway'
    process.env.CARACAL_AUDIT_URL = 'http://audit'
    const secrets = join(process.env.CARACAL_HOME!, 'secrets')
    mkdirSync(secrets, { recursive: true })
    writeFileSync(join(secrets, 'caracalCoordinatorToken'), 'managed-coordinator-token')
    const fetchMock = stubFetch((url) => {
      if (url === 'http://api/health') return { ok: true }
      if (url === 'http://api/v1/zones') return [{ id: 'z1', name: 'Local', slug: 'local' }]
      if (url === 'http://api/v1/zones/z1') return { id: 'z1', name: 'Local', slug: 'local' }
      if (url === 'http://api/v1/zones/z1/resources') return [{ id: 'res-1' }]
      if (url === 'http://api/v1/zones/z1/policy-sets') return [{ id: 'pset-1', active_version_id: 'psver-1' }]
      if (url === 'http://api/v1/zones/z1/grants') return [{ id: 'grant-1' }]
      if (url === 'http://api/v1/zones/z1/audit?limit=1') return []
      if (url.endsWith('/ready')) return { ready: true }
      if (url === 'http://sts/metrics.json') return { opa: { compile_errors: 0, eval_errors: 0, max_policy_age_seconds: 1 } }
      if (url === 'http://gateway/metrics.json') return { bindings_loaded: 3, revocations_active: 1, requests_denied: 2 }
      if (url === 'http://audit/metrics.json') return { consumer_lag: 0, dlq_size: 0, tamper_mismatch_total: 0 }
      if (url === 'http://coordinator/stats') return { outbox: { pending: 0, dead: 0 }, invocations: { running: 0 } }
      throw new Error(`unexpected request ${url}`)
    })

    await expect(doctorCommand(['--zone', 'z1'])).rejects.toThrow('__exit:1')

    const out = stdout.mock.calls.map((c) => c[0]).join('')
    expect(out).toContain('Service readiness')
    expect(out).toContain('sts readiness')
    expect(out).toContain('opa compile_errors=0')
    expect(out).toContain('gateway metrics')
    expect(out).toContain('audit metrics')
    expect(out).toContain('coordinator metrics')
    const statsCall = fetchMock.mock.calls.find((call) => call[0] === 'http://coordinator/stats')
    expect(statsCall?.[1].headers).toEqual({ Authorization: 'Bearer managed-coordinator-token' })
  })

  it('preflight auto-discovers managed secret files without env exports', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'caracal-secrets-'))
    tempDirs.push(dir)
    process.env.CARACAL_SECRETS_DIR = dir
    for (const name of [
      'ZONE_KEK',
      'AUDIT_HMAC_KEY',
      'STREAMS_HMAC_KEY',
      'GATEWAY_STS_HMAC_KEY',
      'CARACAL_COORDINATOR_TOKEN',
      'DATABASE_URL',
      'REDIS_URL',
    ]) {
      delete process.env[name]
      delete process.env[`${name}_FILE`]
    }
    writeFileSync(join(dir, 'zoneKek'), 'a'.repeat(64))
    writeFileSync(join(dir, 'auditHmacKey'), 'b'.repeat(64))
    writeFileSync(join(dir, 'streamsHmacKey'), 'c'.repeat(64))
    writeFileSync(join(dir, 'gatewayStsHmacKey'), 'd'.repeat(64))
    writeFileSync(join(dir, 'databaseUrl'), 'postgres://caracal:secret@postgres:1/caracal')
    writeFileSync(join(dir, 'redisUrl'), 'redis://:secret@redis:1')

    const checks = await runPreflightChecks()

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: 'ZONE_KEK', status: 'ok', detail: '32 bytes (auto-discovered)' }),
      expect.objectContaining({ check: 'AUDIT_HMAC_KEY', status: 'ok', detail: '32 bytes (auto-discovered)' }),
      expect.objectContaining({ check: 'STREAMS_HMAC_KEY', status: 'ok', detail: '32 bytes (auto-discovered)' }),
      expect.objectContaining({ check: 'GATEWAY_STS_HMAC_KEY', status: 'ok', detail: '32 bytes (auto-discovered)' }),
      expect.objectContaining({ check: 'TLS files', status: 'ok', detail: 'not required in dev mode' }),
    ]))
    expect(checks.find((check) => check.check === 'Postgres')?.detail).not.toBe('DATABASE_URL not set')
    expect(checks.find((check) => check.check === 'Redis')?.detail).not.toBe('REDIS_URL not set')
  })

  it('policy-set simulate posts version and input fixture', async () => {
    stubFetch((url, init) => {
      expect(url).toBe('http://api/v1/zones/z1/policy-sets/pset-1/simulate')
      expect(init.method).toBe('POST')
      expect(JSON.parse(String(init.body))).toEqual({
        version_id: 'psver-1',
        input: { schema_version: '2026-05-20', principal: { zone_id: 'z1' } },
      })
      return {
        dry_run: true,
        would_activate: true,
        policy_set_id: 'pset-1',
        version_id: 'psver-1',
        schema_version: '2026-05-20',
        input_schema_version: '2026-05-20',
        manifest_sha256: 'sha',
        policies: ['pver-1'],
        warnings: [],
        explanation: { evaluation: 'not_executed', reason: 'contract validated' },
      }
    })

    await policySetCommand(['simulate', 'pset-1', '--version', 'psver-1', '--input', '{"schema_version":"2026-05-20","principal":{"zone_id":"z1"}}'])

    const out = JSON.parse(stdout.mock.calls.map((c) => c[0]).join(''))
    expect(out).toMatchObject({ dry_run: true, policy_set_id: 'pset-1', warnings: [] })
  })

  it('audit command exits 1 when CARACAL_ADMIN_TOKEN is missing', async () => {
    const cwd = process.cwd()
    process.chdir(mkdtempSync(join(tmpdir(), 'caracal-empty-cwd-')))
    delete process.env.CARACAL_ADMIN_TOKEN
    delete process.env.CARACAL_ENV_FILE
    process.env.CARACAL_HOME = mkdtempSync(join(tmpdir(), 'caracal-empty-home-'))
    try {
      await expect(auditCommand(['tail'])).rejects.toThrow(/__exit:1/)
      expect(stderr.mock.calls.map((c) => c[0]).join('')).toContain('CARACAL_ADMIN_TOKEN')
    } finally {
      process.chdir(cwd)
    }
  })
})
