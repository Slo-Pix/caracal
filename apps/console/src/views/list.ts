// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Generic scrollable list view with column rendering and selection.

import { ansi, copyToClipboard, pad, truncate, ui } from '../ansi.ts'
import { explainError } from '../errors.ts'
import type { Key } from '../keys.ts'
import type { App, View, ViewContext } from '../screen.ts'
import type { ConsoleStateStore } from '../state.ts'
import { actionInfo, openInfo, type InfoPage } from './info.ts'

export interface Column<T> {
  header: string
  width?: number
  value: (row: T) => string
}

export interface ListAction<T> {
  key: string
  label: string
  build: (row: T | undefined, app: App) => View | Promise<View>
  info?: InfoPage
}

export interface ListOptions<T> {
  title: string
  columns: Column<T>[]
  load: () => Promise<T[]>
  onEnter?: (app: App, row: T) => void | Promise<void>
  actions?: ListAction<T>[]
  state?: ConsoleStateStore | undefined
  stateKey?: string
  zoneId?: string
  rowKey?: (row: T) => string
  rowId?: (row: T) => string
  rowName?: (row: T) => string
  info?: InfoPage
}

export class ListView<T> implements View {
  readonly title: string
  private readonly columns: Column<T>[]
  private readonly loader: () => Promise<T[]>
  private readonly enter?: (app: App, row: T) => void | Promise<void>
  private readonly actions: ListAction<T>[]
  private readonly state?: ConsoleStateStore
  private readonly stateKey?: string
  private readonly zoneId?: string
  private readonly rowKey?: (row: T) => string
  private readonly rowId?: (row: T) => string
  private readonly rowName?: (row: T) => string
  private readonly info: InfoPage
  private rows: T[] = []
  private cursor = 0
  private offset = 0
  private loading = true
  private error: string | undefined
  private showIds = false
  private aborted = false
  private app: App | undefined

  constructor(opts: ListOptions<T>) {
    this.title = opts.title
    this.columns = opts.columns
    this.loader = opts.load
    this.enter = opts.onEnter
    this.actions = opts.actions ?? []
    this.state = opts.state
    this.stateKey = opts.stateKey
    this.zoneId = opts.zoneId
    this.rowKey = opts.rowKey
    this.rowId = opts.rowId
    this.rowName = opts.rowName
    this.info = opts.info ?? actionInfo(opts.title, 'Opening a row shows details; action keys create, edit, delete, or operate on the selected record.')
  }

  selected(): T | undefined { return this.rows[this.cursor] }

  hints(): string[] {
    const base = ['↑/↓:move', 'enter:open', 'r:reload', '?:info', 'esc:back']
    for (const a of this.actions) base.push(`${a.key}:${a.label}`)
    if (this.rowId) base.push('V:reveal-id', 'I:copy-id')
    if (this.rowName) base.push('N:copy-name')
    return base
  }

  async init(app: App): Promise<void> { this.app = app; await this.reload() }

  dispose(): void { this.aborted = true }

  async reload(): Promise<void> {
    const app = this.app
    this.loading = true
    this.error = undefined
    app?.invalidate()
    try {
      const rows = await this.loader()
      if (this.aborted) return
      this.rows = rows
      const selectedId = this.stateKey ? this.state?.listSelection(this.stateKey, this.zoneId) : undefined
      const selectedIndex = selectedId && this.rowKey ? rows.findIndex((row) => this.rowKey!(row) === selectedId) : -1
      this.cursor = selectedIndex >= 0 ? selectedIndex : Math.min(this.cursor, Math.max(0, rows.length - 1))
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

  render(ctx: ViewContext): string[] {
    const lines: string[] = []
    if (this.loading) { lines.push(ui.muted(' loading...')); return lines }
    if (this.error) { lines.push(ui.error(' error: ' + this.error)); return lines }
    if (this.rows.length === 0) { lines.push(ui.muted(' No records found.')); return lines }
    const columns = this.renderColumns()
    const widths = this.computeWidths(ctx.size.cols, columns)
    lines.push(this.headerRow(widths))
    const visible = Math.max(1, ctx.size.rows - 1)
    if (this.cursor < this.offset) this.offset = this.cursor
    if (this.cursor >= this.offset + visible) this.offset = this.cursor - visible + 1
    for (let i = this.offset; i < Math.min(this.rows.length, this.offset + visible); i++) {
      const row = this.rows[i]!
      const text = columns
        .map((c, idx) => pad(truncate(c.value(row), widths[idx]!), widths[idx]!))
        .join('  ')
      const line = ' ' + text + ' '
      lines.push(i === this.cursor ? ui.selected(line) : line)
    }
    return lines
  }

  private renderColumns(): Column<T>[] {
    if (!this.showIds || !this.rowId) return this.columns
    return [...this.columns, { header: 'id', value: (row) => this.rowId!(row) }]
  }

  private computeWidths(cols: number, columns: Column<T>[]): number[] {
    const total = columns.reduce((sum, c) => sum + (c.width ?? 16) + 2, 0) - 2
    if (total <= cols - 4) return columns.map((c) => c.width ?? 16)
    const last = columns.length - 1
    const fixed = columns.slice(0, -1).reduce((s, c) => s + (c.width ?? 16) + 2, 0)
    const remaining = Math.max(8, cols - 4 - fixed)
    return columns.map((c, i) => (i === last ? remaining : (c.width ?? 16)))
  }

  private headerRow(widths: number[]): string {
    const text = this.renderColumns().map((c, i) => pad(c.header, widths[i]!)).join('  ')
    return ui.muted(' ' + ansi.bold + text + ansi.reset)
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    const last = Math.max(0, this.rows.length - 1)
    const action = this.actions.find((a) => a.key === key)
    if (action) {
      this.persistSelection()
      const view = await action.build(this.selected(), ctx.app)
      ctx.app.push(view)
      return
    }
    if (key === 'up' || key === 'k') { this.cursor = Math.max(0, this.cursor - 1); this.persistSelection(); return }
    if (key === 'down' || key === 'j') { this.cursor = Math.min(last, this.cursor + 1); this.persistSelection(); return }
    if (key === 'pgup') { this.cursor = Math.max(0, this.cursor - 10); this.persistSelection(); return }
    if (key === 'pgdn') { this.cursor = Math.min(last, this.cursor + 10); this.persistSelection(); return }
    if (key === 'home' || key === 'g') { this.cursor = 0; this.persistSelection(); return }
    if (key === 'end' || key === 'G') { this.cursor = last; this.persistSelection(); return }
    if (key === 'r') return this.reload()
    if (key === '?') {
      openInfo(ctx.app, this.selectedInfo())
      return
    }
    if (key === 'V' && this.rowId) { this.showIds = !this.showIds; return }
    if (key === 'I' && this.rowId) { this.copyId(ctx.app); return }
    if (key === 'N' && this.rowName) { this.copyName(ctx.app); return }
    if (key === 'left' || key === 'esc') { ctx.app.pop(); return }
    if (key === 'enter') {
      const row = this.selected()
      this.persistSelection()
      if (row && this.enter) await this.enter(ctx.app, row)
    }
  }

  private persistSelection(): void {
    if (!this.state || !this.stateKey || !this.rowKey) return
    const row = this.selected()
    this.state.setListSelection(this.stateKey, row ? this.rowKey(row) : undefined, this.zoneId)
  }

  private copyId(app: App): void {
    const row = this.selected()
    if (!row || !this.rowId) return
    const id = this.rowId(row)
    copyToClipboard(id)
    app.setStatus(`copied id for ${this.rowName?.(row) ?? id}`)
  }

  private copyName(app: App): void {
    const row = this.selected()
    if (!row || !this.rowName) return
    const name = this.rowName(row)
    copyToClipboard(name)
    app.setStatus(`copied name ${name}`)
  }

  private selectedInfo(): InfoPage {
    const row = this.selected()
    const name = row && this.rowName ? this.rowName(row) : this.title
    return {
      ...this.info,
      title: row ? `${this.title}: ${name}` : this.info.title,
      after: row
        ? 'Press enter for details, use action keys for changes, or reveal/copy the internal ID only when another system needs it.'
        : this.info.after,
    }
  }
}
