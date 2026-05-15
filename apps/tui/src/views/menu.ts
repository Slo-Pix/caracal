// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Top-level menu listing every resource the TUI can navigate.

import type { AdminClient, Zone } from '@caracalai/admin'
import {
  composeRun,
  credentialRead,
  runExec,
  stackDown,
  stackStatus,
  stackUp,
} from '@caracalai/engine'
import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import {
  resolveCliConfigPath,
  resolveServiceUrl,
  type CliConfig,
} from '@caracalai/core/cli'
import { ansi } from '../ansi.ts'
import { explainError } from '../errors.ts'
import type { Key } from '../keys.ts'
import type { App, View, ViewContext } from '../screen.ts'
import { DetailView } from './detail.ts'
import { ConfirmView, FormView } from './form.ts'
import {
  agentsView,
  applicationsView,
  auditView,
  delegationsView,
  grantsView,
  policiesView,
  policySetsView,
  providersView,
  resourcesView,
  sessionsView,
  zonesView,
  type Ctx,
} from './factory.ts'
import { resolveStackPaths } from '@caracalai/engine'
import { CARACAL_TUI_MODE } from '../version.gen.ts'
import { StreamView } from './stream.ts'

interface Entry {
  key: string
  label: string
  needsZone: boolean
  open: (ctx: Ctx, app: App) => View
}

function loadCliConfig(): CliConfig | undefined {
  const path = resolveCliConfigPath()
  if (!path) return undefined
  try { return parse(readFileSync(path, 'utf8')) as unknown as CliConfig } catch { return undefined }
}

function tokenizeArgv(input: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let quote: '"' | "'" | undefined
  for (const ch of input) {
    if (ch === '\u0000') throw new Error('argv contains NUL byte')
    if (quote) {
      if (ch === quote) { quote = undefined; continue }
      cur += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === ' ' || ch === '\t') {
      if (cur.length > 0) { tokens.push(cur); cur = '' }
      continue
    }
    cur += ch
  }
  if (quote) throw new Error('unterminated quote in argv')
  if (cur.length > 0) tokens.push(cur)
  return tokens
}

function parseEnv(list: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of list.split(',').map((s) => s.trim()).filter((s) => s.length > 0)) {
    const eq = pair.indexOf('=')
    if (eq < 0) throw new Error(`env entry "${pair}" missing '='`)
    out[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  return out
}

const ENTRIES: Entry[] = [
  { key: '1', label: 'Zones',         needsZone: false, open: zonesView },
  { key: '2', label: 'Applications',  needsZone: true,  open: applicationsView },
  { key: '3', label: 'Resources',     needsZone: true,  open: resourcesView },
  { key: '4', label: 'Providers',     needsZone: true,  open: providersView },
  { key: '5', label: 'Policies',      needsZone: true,  open: policiesView },
  { key: '6', label: 'Policy-sets',   needsZone: true,  open: policySetsView },
  { key: '7', label: 'Grants',        needsZone: true,  open: grantsView },
  { key: '8', label: 'Sessions',      needsZone: true,  open: sessionsView },
  { key: '9', label: 'Audit (live)',  needsZone: true,  open: auditView },
  { key: '0', label: 'Agents',        needsZone: true,  open: agentsView },
  { key: 'g', label: 'Delegations',   needsZone: true,  open: delegationsView },
  { key: 'x', label: 'Audit explain', needsZone: true,  open: auditExplainEntry },
  { key: 'c', label: 'Credential',    needsZone: false, open: credentialEntry },
  { key: 's', label: 'Stack',         needsZone: false, open: stackEntry },
  { key: 'u', label: 'Run',           needsZone: false, open: runEntry },
]

function auditExplainEntry(ctx: Ctx): View {
  return new FormView({
    title: 'audit explain',
    fields: [{ key: 'request_id', label: 'request_id', kind: 'text', required: true }],
    onSubmit: async (v, app) => {
      app.pop()
      app.push(new DetailView({
        title: `audit / ${v.request_id}`,
        load: () => ctx.client.audit.byRequest(ctx.zoneId, v.request_id!),
      }))
    },
  })
}

function credentialEntry(): View {
  return new FormView({
    title: 'credential read',
    fields: [
      { key: 'resource', label: 'resource', kind: 'text', required: true },
      { key: 'ttl', label: 'ttl seconds', kind: 'text' },
    ],
    onSubmit: async (v, app) => {
      const cfg = loadCliConfig()
      if (!cfg) throw new Error('caracal.toml not found')
      const ttl = v.ttl ? Number(v.ttl) : undefined
      const token = await credentialRead({ cfg, resource: v.resource!, ttlSeconds: ttl })
      app.pop()
      app.push(new DetailView({
        title: `credential / ${v.resource}`,
        load: async () => ({ resource: v.resource, access_token: token }),
        mask: (_value, path) => {
          const leaf = path[path.length - 1]
          if (leaf === 'access_token' || leaf === 'refresh_token' || leaf === 'client_secret') return '••••'
          return undefined
        },
      }))
    },
  })
}

function stackEntry(): View {
  return new StackMenuView()
}

function runEntry(): View {
  return new FormView({
    title: 'run',
    fields: [
      { key: 'argv', label: 'argv', kind: 'text', required: true, hint: 'shell-quoted, no metacharacters' },
      { key: 'env', label: 'env (KEY=VAL csv)', kind: 'list' },
    ],
    onSubmit: async (v, app) => {
      const argv = tokenizeArgv(v.argv ?? '')
      if (argv.length === 0) throw new Error('argv is empty')
      const env = v.env ? parseEnv(v.env) : undefined
      app.pop()
      app.push(new StreamView({
        title: `run ${argv[0]}`,
        spawn: (onLine) => {
          const handle = runExec({
            argv, env, onLine: (line) => onLine(line), forwardSignals: false,
          })
          return { dispose: handle.dispose, exitCode: handle.exitCode }
        },
      }))
    },
  })
}

class StackMenuView implements View {
  readonly title = 'stack'
  private cursor = 0
  private items: { key: string; label: string; build: (app: App) => View | Promise<View> }[]

  constructor() {
    this.items = [
      { key: 'u', label: 'up', build: () => stackComposeStream('up', stackUp) },
      { key: 'd', label: 'down', build: () => stackComposeStream('down', stackDown) },
      { key: 's', label: 'status', build: () => stackStatusDetail() },
      { key: 'p', label: 'purge', build: () => stackPurgeForm() },
    ]
  }

  hints(): string[] { return ['↑/↓:select', 'enter:open', 'h:back'] }

  render(_ctx: ViewContext): string[] {
    const lines: string[] = ['', ' ' + ansi.bold + 'Stack' + ansi.reset, '']
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]!
      const text = `[${it.key}] ${it.label}`
      const prefix = i === this.cursor ? ansi.invert + ' ' : '  '
      const suffix = i === this.cursor ? ' ' + ansi.reset : ''
      lines.push(prefix + text + suffix)
    }
    return lines
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    if (key === 'up' || key === 'k') { this.cursor = Math.max(0, this.cursor - 1); return }
    if (key === 'down' || key === 'j') { this.cursor = Math.min(this.items.length - 1, this.cursor + 1); return }
    if (key === 'left' || key === 'h' || key === 'esc') { ctx.app.pop(); return }
    const direct = this.items.findIndex((it) => it.key === key)
    if (direct >= 0) {
      const built = await this.items[direct]!.build(ctx.app)
      ctx.app.push(built)
      return
    }
    if (key === 'enter') {
      const built = await this.items[this.cursor]!.build(ctx.app)
      ctx.app.push(built)
    }
  }
}

type ComposeFn = (opts: {
  paths: import('@caracalai/engine').StackPaths
  args: string[]
  env?: Record<string, string | undefined>
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void
}) => { dispose: () => void; exitCode: Promise<number> }

function stackComposeStream(label: 'up' | 'down', fn: ComposeFn): View {
  return new StreamView({
    title: `stack ${label}`,
    spawn: (onLine) => {
      const paths = resolveStackPaths({ mode: CARACAL_TUI_MODE })
      return fn({
        paths,
        args: [],
        onLine: (line) => onLine(line),
      })
    },
  })
}

function stackStatusDetail(): View {
  return new DetailView({ title: 'stack status', load: () => stackStatus() })
}

function stackPurgeForm(): View {
  return new ConfirmView({
    message: 'purge stack? (compose down -v --remove-orphans)',
    onConfirm: async (app) => {
      app.pop()
      app.push(new StreamView({
        title: 'stack purge',
        spawn: (onLine) => {
          const paths = resolveStackPaths({ mode: CARACAL_TUI_MODE })
          return composeRun({
            paths,
            args: ['down', '-v', '--remove-orphans'],
            onLine: (line) => onLine(line),
          })
        },
      }))
    },
  })
}

export class MenuView implements View {
  readonly title = 'menu'
  private readonly client: AdminClient
  private zoneId: string | undefined
  private cursor = 0

  constructor(client: AdminClient, zoneId: string | undefined) {
    this.client = client
    this.zoneId = zoneId
  }

  hints(): string[] {
    return ['↑/↓ or hot-key:select', 'enter:open', 'z:set-zone']
  }

  currentZoneId(): string | undefined { return this.zoneId }

  async init(app: App): Promise<void> {
    if (!this.zoneId) return
    try {
      await this.client.zones.get(this.zoneId)
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 404) {
        const stale = this.zoneId
        this.zoneId = undefined
        app.setStatus(`configured zone ${stale} no longer exists — press z to pick another or open Zones to create one`, 'error')
        app.invalidate()
      }
    }
  }

  setZone(id: string, slug: string | undefined, app: App): void {
    this.zoneId = id
    app.setStatus(`zone set to ${slug ?? id}`)
    app.invalidate()
  }

  render(_ctx: ViewContext): string[] {
    const lines: string[] = []
    lines.push('')
    lines.push(' ' + ansi.bold + 'Caracal' + ansi.reset + ansi.dim + '  Inspect and manage the OSS stack interactively.' + ansi.reset)
    lines.push('')
    const zone = this.zoneId ? ansi.fg(76) + this.zoneId + ansi.reset : ansi.fg(214) + '(no zone selected)' + ansi.reset
    lines.push(' zone: ' + zone)
    lines.push('')
    for (let i = 0; i < ENTRIES.length; i++) {
      const e = ENTRIES[i]!
      const disabled = e.needsZone && !this.zoneId
      const label = `[${e.key}] ${e.label}` + (disabled ? ansi.dim + '  (zone required)' + ansi.reset : '')
      const prefix = i === this.cursor ? ansi.invert + ' ' : '  '
      const suffix = i === this.cursor ? ' ' + ansi.reset : ''
      lines.push(prefix + label + suffix)
    }
    lines.push('')
    return lines
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    if (key === 'up' || key === 'k') { this.cursor = Math.max(0, this.cursor - 1); return }
    if (key === 'down' || key === 'j') { this.cursor = Math.min(ENTRIES.length - 1, this.cursor + 1); return }
    const direct = ENTRIES.findIndex((e) => e.key === key)
    if (direct >= 0) { this.cursor = direct; this.open(ctx.app); return }
    if (key === 'enter') { this.open(ctx.app); return }
    if (key === 'z') return this.promptZone(ctx.app)
  }

  private open(app: App): void {
    const e = ENTRIES[this.cursor]!
    if (e.needsZone && !this.zoneId) {
      app.setStatus('zone required — press z to set one or pick Zones first', 'error')
      return
    }
    const ctx: Ctx = {
      client: this.client,
      zoneId: this.zoneId ?? '',
      onZoneSelect: (id, slug) => this.setZone(id, slug, app),
    }
    app.push(e.open(ctx, app))
  }

  private async promptZone(app: App): Promise<void> {
    try {
      const zones = await this.client.zones.list()
      if (zones.length === 0) { app.setStatus('no zones — open Zones (n) to create one, or run `caracal zone create --name <n>`', 'error'); return }
      app.push(new ZonePickerView(zones, (id, slug) => this.setZone(id, slug, app)))
    } catch (err) {
      app.setStatus(`zone list: ${explainError(err)}`, 'error')
    }
  }
}

class ZonePickerView implements View {
  readonly title = 'select zone'
  private cursor = 0
  private offset = 0
  private readonly zones: Zone[]
  private readonly pick: (id: string, slug: string) => void

  constructor(zones: Zone[], pick: (id: string, slug: string) => void) {
    this.zones = zones
    this.pick = pick
  }

  hints(): string[] { return ['↑/↓:move', 'enter:select', 'h:back'] }

  render(ctx: ViewContext): string[] {
    const lines: string[] = ['', ' Pick a zone to administer:']
    const visible = Math.max(1, ctx.size.rows - 2)
    if (this.cursor < this.offset) this.offset = this.cursor
    if (this.cursor >= this.offset + visible) this.offset = this.cursor - visible + 1
    for (let i = this.offset; i < Math.min(this.zones.length, this.offset + visible); i++) {
      const z = this.zones[i]!
      const text = `${z.slug.padEnd(20)} ${z.id}  ${z.name ?? ''}`
      lines.push(i === this.cursor ? ansi.invert + ' ' + text + ' ' + ansi.reset : ' ' + text)
    }
    return lines
  }

  onKey(key: Key, ctx: ViewContext): void {
    if (key === 'up' || key === 'k') { this.cursor = Math.max(0, this.cursor - 1); return }
    if (key === 'down' || key === 'j') { this.cursor = Math.min(this.zones.length - 1, this.cursor + 1); return }
    if (key === 'pgup') { this.cursor = Math.max(0, this.cursor - 10); return }
    if (key === 'pgdn') { this.cursor = Math.min(this.zones.length - 1, this.cursor + 10); return }
    if (key === 'home' || key === 'g') { this.cursor = 0; return }
    if (key === 'end' || key === 'G') { this.cursor = this.zones.length - 1; return }
    if (key === 'enter') {
      const z = this.zones[this.cursor]!
      this.pick(z.id, z.slug)
      ctx.app.pop()
      return
    }
    if (key === 'left' || key === 'h' || key === 'esc') ctx.app.pop()
  }
}

// Resolved at module load — referenced via ENTRIES so tokenizer is testable.
export const __testInternals = { tokenizeArgv, parseEnv }
