// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JSON detail view: pretty-printed scrollable inspection of a single record.

import { ansi } from '../ansi.ts'
import { explainError } from '../errors.ts'
import type { Key } from '../keys.ts'
import type { App, View, ViewContext } from '../screen.ts'

export interface DetailOptions {
  title: string
  load: () => Promise<unknown>
  mask?: (value: unknown, path: string[]) => string | undefined
}

export class DetailView implements View {
  readonly title: string
  private readonly loader: () => Promise<unknown>
  private readonly mask?: (value: unknown, path: string[]) => string | undefined
  private data: unknown
  private body: string[] = [' loading…']
  private offset = 0
  private loading = true
  private error: string | undefined
  private aborted = false
  private revealed = false
  private app: App | undefined

  constructor(opts: DetailOptions) {
    this.title = opts.title
    this.loader = opts.load
    this.mask = opts.mask
  }

  hints(): string[] {
    const base = ['↑/↓:scroll', 'r:reload', 'h:back']
    if (this.mask) base.push(this.revealed ? 'ctrl-r:mask' : 'ctrl-r:reveal')
    return base
  }

  async init(app: App): Promise<void> { this.app = app; await this.reload() }

  dispose(): void { this.aborted = true }

  async reload(): Promise<void> {
    const app = this.app
    this.loading = true
    this.error = undefined
    this.body = [' loading…']
    app?.invalidate()
    try {
      const data = await this.loader()
      if (this.aborted) return
      this.data = data
      this.rebuild()
      this.offset = 0
    } catch (err) {
      if (this.aborted) return
      this.error = explainError(err)
    } finally {
      if (!this.aborted) {
        this.loading = false
        app?.invalidate()
      }
    }
  }

  private rebuild(): void {
    this.body = renderJson(this.data, [], this.mask, this.revealed).split('\n')
  }

  render(ctx: ViewContext): string[] {
    if (this.loading) return [ansi.dim + ' loading…' + ansi.reset]
    if (this.error) return [ansi.fg(196) + ' error: ' + this.error + ansi.reset]
    const lines: string[] = []
    for (let i = this.offset; i < Math.min(this.body.length, this.offset + ctx.size.rows); i++) {
      lines.push(' ' + this.body[i])
    }
    return lines
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    const max = Math.max(0, this.body.length - ctx.size.rows)
    if (key === 'up' || key === 'k') { this.offset = Math.max(0, this.offset - 1); return }
    if (key === 'down' || key === 'j') { this.offset = Math.min(max, this.offset + 1); return }
    if (key === 'pgup') { this.offset = Math.max(0, this.offset - 10); return }
    if (key === 'pgdn') { this.offset = Math.min(max, this.offset + 10); return }
    if (key === 'home' || key === 'g') { this.offset = 0; return }
    if (key === 'end' || key === 'G') { this.offset = max; return }
    if (key === 'r') return this.reload()
    if (key === '\u0012' && this.mask) {
      this.revealed = !this.revealed
      this.rebuild()
      ctx.app.invalidate()
      return
    }
    if (key === 'left' || key === 'h' || key === 'esc') ctx.app.pop()
  }
}

function renderJson(
  value: unknown,
  path: string[],
  mask: ((value: unknown, path: string[]) => string | undefined) | undefined,
  revealed: boolean,
  indent = 0,
): string {
  const pad = ' '.repeat(indent)
  if (mask && !revealed) {
    const masked = mask(value, path)
    if (typeof masked === 'string') return JSON.stringify(masked)
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const inner = value
      .map((v, i) => pad + '  ' + renderJson(v, [...path, String(i)], mask, revealed, indent + 2))
      .join(',\n')
    return '[\n' + inner + '\n' + pad + ']'
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  const inner = entries
    .map(([k, v]) => pad + '  ' + JSON.stringify(k) + ': ' + renderJson(v, [...path, k], mask, revealed, indent + 2))
    .join(',\n')
  return '{\n' + inner + '\n' + pad + '}'
}
