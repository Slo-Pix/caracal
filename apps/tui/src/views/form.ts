// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// FormView and ConfirmView for in-TUI create/edit/delete workflows.

import { ansi } from '../ansi.ts'
import { explainError } from '../errors.ts'
import type { Key } from '../keys.ts'
import type { App, View, ViewContext } from '../screen.ts'

export interface FieldDef {
  label: string
  key: string
  placeholder?: string
  required?: boolean
  hint?: string
}

type SubmitFn = (values: Record<string, string>, app: App) => Promise<void>

export class FormView implements View {
  readonly title: string
  readonly isTextEntry = true as const
  private fields: Array<FieldDef & { value: string }>
  private fieldIdx = 0
  private colOffset = 0
  private submitting = false
  private error: string | undefined
  private readonly onSubmit: SubmitFn

  constructor(title: string, fields: FieldDef[], onSubmit: SubmitFn, initial: Record<string, string> = {}) {
    this.title = title
    this.fields = fields.map((f) => ({ ...f, value: initial[f.key] ?? '' }))
    this.onSubmit = onSubmit
    this.colOffset = this.fields[0]?.value.length ?? 0
  }

  hints(): string[] {
    return ['↑/↓/Tab:field', 'Ctrl+S:submit', 'Esc:cancel']
  }

  render(ctx: ViewContext): string[] {
    const lines: string[] = ['']
    if (this.submitting) {
      lines.push(ansi.dim + '  submitting…' + ansi.reset)
      return lines
    }
    if (this.error) {
      lines.push(ansi.fg(196) + '  error: ' + this.error + ansi.reset)
      lines.push('')
    }
    const labelWidth = Math.max(6, ...this.fields.map((f) => f.label.length)) + 2
    const inputWidth = Math.max(20, ctx.size.cols - labelWidth - 8)
    for (let i = 0; i < this.fields.length; i++) {
      const f = this.fields[i]!
      const active = i === this.fieldIdx
      const labelStr = (f.required ? f.label + '*' : f.label) + ':'
      const paddedLabel = labelStr.padEnd(labelWidth)
      const value = f.value
      const col = active ? this.colOffset : value.length
      const scrollStart = Math.max(0, col - inputWidth + 1)
      const visible = value.slice(scrollStart, scrollStart + inputWidth)
      const cursorInView = col - scrollStart
      let inputContent: string
      if (active) {
        const before = visible.slice(0, cursorInView)
        const ch = visible[cursorInView] ?? ' '
        const after = visible.slice(cursorInView + 1)
        inputContent = before + ansi.invert + ch + ansi.reset + after
      } else if (value) {
        inputContent = visible
      } else {
        inputContent = ansi.dim + (f.placeholder ?? '') + ansi.reset
      }
      const bracketColor = active ? ansi.fg(76) : ansi.dim
      const labelColor = active ? ansi.bold : ''
      const field = bracketColor + '[' + ansi.reset + ' ' + inputContent + ' ' + bracketColor + ']' + ansi.reset
      const hintText = f.hint ? ansi.dim + '  ' + f.hint + ansi.reset : ''
      lines.push('  ' + labelColor + paddedLabel + ansi.reset + '  ' + field + hintText)
    }
    lines.push('')
    lines.push(ansi.dim + '  * required   Ctrl+S: submit   Esc: cancel' + ansi.reset)
    return lines
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    if (key === 'esc') { ctx.app.pop(); return }
    if (key === 'ctrl-s') { await this.submit(ctx.app); return }
    if (key === 'tab' || key === 'down') {
      this.fieldIdx = Math.min(this.fields.length - 1, this.fieldIdx + 1)
      this.colOffset = this.fields[this.fieldIdx]!.value.length
      return
    }
    if (key === 'up') {
      this.fieldIdx = Math.max(0, this.fieldIdx - 1)
      this.colOffset = this.fields[this.fieldIdx]!.value.length
      return
    }
    if (key === 'enter') {
      if (this.fieldIdx < this.fields.length - 1) {
        this.fieldIdx++
        this.colOffset = this.fields[this.fieldIdx]!.value.length
      } else {
        await this.submit(ctx.app)
      }
      return
    }
    if (key === 'left') { this.colOffset = Math.max(0, this.colOffset - 1); return }
    if (key === 'right') {
      this.colOffset = Math.min(this.fields[this.fieldIdx]!.value.length, this.colOffset + 1)
      return
    }
    if (key === 'home') { this.colOffset = 0; return }
    if (key === 'end') { this.colOffset = this.fields[this.fieldIdx]!.value.length; return }
    if (key === 'backspace') {
      const f = this.fields[this.fieldIdx]!
      if (this.colOffset > 0) {
        f.value = f.value.slice(0, this.colOffset - 1) + f.value.slice(this.colOffset)
        this.colOffset--
      }
      return
    }
    if (key.length === 1 && key.charCodeAt(0) >= 32) {
      const f = this.fields[this.fieldIdx]!
      f.value = f.value.slice(0, this.colOffset) + key + f.value.slice(this.colOffset)
      this.colOffset++
      return
    }
  }

  private async submit(app: App): Promise<void> {
    const missing = this.fields.filter((f) => f.required && !f.value.trim())
    if (missing.length > 0) {
      this.error = `required: ${missing.map((f) => f.label).join(', ')}`
      app.invalidate()
      return
    }
    this.submitting = true
    this.error = undefined
    app.invalidate()
    try {
      const values = Object.fromEntries(this.fields.map((f) => [f.key, f.value.trim()]))
      await this.onSubmit(values, app)
      app.pop()
    } catch (err) {
      this.error = explainError(err)
      this.submitting = false
      app.invalidate()
    }
  }
}

export class ConfirmView implements View {
  readonly title: string
  private readonly message: string
  private readonly action: (app: App) => Promise<void>

  constructor(title: string, message: string, action: (app: App) => Promise<void>) {
    this.title = title
    this.message = message
    this.action = action
  }

  hints(): string[] { return ['y:confirm', 'n/Esc:cancel'] }

  render(_ctx: ViewContext): string[] {
    return [
      '',
      '  !! ' + this.message,
      '',
      '  Press ' + ansi.bold + 'y' + ansi.reset + ' to confirm, any other key to cancel.',
    ]
  }

  async onKey(key: Key, ctx: ViewContext): Promise<void> {
    ctx.app.pop()
    if (key === 'y') {
      try {
        await this.action(ctx.app)
      } catch (err) {
        ctx.app.setStatus(explainError(err), 'error')
      }
    }
  }
}
