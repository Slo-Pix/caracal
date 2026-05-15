// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// StreamView: scrollable view backed by a child-process stdout/stderr line ring buffer.

import { ansi, sanitizeAnsi } from '../ansi.ts'
import type { Key } from '../keys.ts'
import type { App, View, ViewContext } from '../screen.ts'

const RING_CAP = 2000

export interface StreamHandle {
  dispose: () => void
  exitCode: Promise<number>
}

export interface StreamSpawn {
  (onLine: (line: string) => void): Promise<StreamHandle> | StreamHandle
}

export interface StreamOpts {
  title: string
  spawn: StreamSpawn
}

export class StreamView implements View {
  readonly title: string
  private readonly spawnFn: StreamSpawn
  private buf: string[] = []
  private offset = 0
  private auto = true
  private handle: StreamHandle | undefined
  private exitStatus: number | undefined
  private app: App | undefined
  private starting = true
  private startError: string | undefined

  constructor(opts: StreamOpts) {
    this.title = opts.title
    this.spawnFn = opts.spawn
  }

  hints(): string[] {
    return ['j/k:scroll', 'pgup/pgdn:page', 'G:tail', 'h/esc:back']
  }

  async init(app: App): Promise<void> {
    this.app = app
    try {
      const handle = await this.spawnFn((line) => this.append(line))
      this.handle = handle
      this.starting = false
      app.invalidate()
      handle.exitCode.then((code) => {
        this.exitStatus = code
        app.invalidate()
      }).catch(() => { /* settled */ })
    } catch (err) {
      this.starting = false
      this.startError = err instanceof Error ? err.message : String(err)
      app.invalidate()
    }
  }

  dispose(): void {
    if (this.handle) {
      try { this.handle.dispose() } catch { /* ignore */ }
      const h = this.handle
      const t = setTimeout(() => {
        try {
          // SIGKILL escalation; the StreamHandle's underlying child holds its own
          // kill path via runExec.dispose, but we cannot reach the pid from here,
          // so we resolve through a second dispose call that is idempotent.
          h.dispose()
        } catch { /* ignore */ }
      }, 2000)
      t.unref?.()
    }
  }

  private append(line: string): void {
    const clean = sanitizeAnsi(line)
    this.buf.push(clean)
    if (this.buf.length > RING_CAP) this.buf.splice(0, this.buf.length - RING_CAP)
    if (this.auto) this.offset = Math.max(0, this.buf.length - 1)
    this.app?.invalidate()
  }

  render(ctx: ViewContext): string[] {
    const lines: string[] = []
    const status = this.starting
      ? ansi.dim + ' starting…' + ansi.reset
      : this.startError
        ? ansi.fg(196) + ' spawn error: ' + this.startError + ansi.reset
        : this.exitStatus === undefined
          ? ansi.dim + ` running (${this.buf.length} lines)` + ansi.reset
          : (this.exitStatus === 0 ? ansi.fg(76) : ansi.fg(196)) + ` exited(${this.exitStatus})` + ansi.reset
    lines.push(' ' + status)
    const visible = Math.max(1, ctx.size.rows - 1)
    const start = Math.max(0, Math.min(this.buf.length, this.offset + 1) - visible)
    const top = Math.max(0, start)
    for (let i = top; i < Math.min(this.buf.length, top + visible); i++) {
      lines.push(' ' + this.buf[i])
    }
    return lines
  }

  onKey(key: Key, ctx: ViewContext): void {
    const last = Math.max(0, this.buf.length - 1)
    if (key === 'up' || key === 'k') { this.auto = false; this.offset = Math.max(0, this.offset - 1); return }
    if (key === 'down' || key === 'j') { this.auto = false; this.offset = Math.min(last, this.offset + 1); return }
    if (key === 'pgup') { this.auto = false; this.offset = Math.max(0, this.offset - 10); return }
    if (key === 'pgdn') { this.auto = false; this.offset = Math.min(last, this.offset + 10); return }
    if (key === 'G' || key === 'end') { this.auto = true; this.offset = last; return }
    if (key === 'left' || key === 'h' || key === 'esc') ctx.app.pop()
  }
}
