// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Focused contextual info pages for Console controls and fields.

import { pad, sanitizeAnsi, ui } from '../ansi.ts'
import type { Key } from '../keys.ts'
import type { App, View, ViewContext } from '../screen.ts'

export interface InfoPage {
  title: string
  meaning: string
  when: string
  example?: string
  valid: string
  after: string
}

export interface FieldInfoOpts {
  required?: boolean
  picker?: boolean
  advanced?: boolean
  options?: readonly string[]
  dependency?: string
}

export function infoPage(page: InfoPage): InfoPage {
  return page
}

export function fieldInfo(label: string, kind: string, hint?: string, opts: FieldInfoOpts = {}): InfoPage {
  const title = label || 'Field'
  const required = opts.required ? 'Required for this path.' : 'Optional for this path.'
  return {
    title,
    meaning: hint ? sentence(hint) : `${title} tells Console how to prepare this action.`,
    when: [whenFor(kind, opts), opts.dependency].filter(Boolean).join(' '),
    example: exampleFor(kind, title, opts.options),
    valid: `${required} ${validFor(kind, opts.options)}`,
    after: opts.advanced
      ? 'After saving advanced options, Console keeps this value on the parent form and sends it only when you submit.'
      : 'After submit, Console sends this value to the Control API and shows the result or validation error.',
  }
}

export function actionInfo(label: string, after = 'After confirmation, Console runs the action and refreshes the current view.'): InfoPage {
  return {
    title: label,
    meaning: `${label} runs the selected Console action.`,
    when: 'Use it after reviewing the visible values and any advanced settings that apply.',
    example: label.toLowerCase().includes('create') ? 'Create resource' : label,
    valid: 'The action is valid when required fields are complete and selected objects still exist.',
    after,
  }
}

export function openInfo(app: App, page: InfoPage | undefined): void {
  if (!page) {
    app.setStatus('no info page for this item yet', 'error')
    return
  }
  app.push(new InfoView(page))
}

export class InfoView implements View {
  readonly title: string
  readonly isTextEntry = true
  private readonly page: InfoPage
  private offset = 0

  constructor(page: InfoPage) {
    this.page = page
    this.title = `info / ${page.title}`
  }

  hints(): string[] { return ['↑/↓:scroll', 'esc:back'] }

  render(ctx: ViewContext): string[] {
    const body = this.bodyLines()
    return body.slice(this.offset, this.offset + ctx.size.rows)
  }

  onKey(key: Key, ctx: ViewContext): void {
    const max = Math.max(0, this.bodyLines().length - ctx.size.rows)
    if (key === 'up' || key === 'k') { this.offset = Math.max(0, this.offset - 1); return }
    if (key === 'down' || key === 'j') { this.offset = Math.min(max, this.offset + 1); return }
    if (key === 'esc' || key === 'left') ctx.app.pop()
  }

  private bodyLines(): string[] {
    const lines = [
      '',
      ' ' + ui.title(this.page.title),
      '',
      infoLine('Means', this.page.meaning),
      infoLine('Use when', this.page.when),
    ]
    if (this.page.example) lines.push(infoLine('Example', this.page.example))
    lines.push(
      infoLine('Valid input', this.page.valid),
      infoLine('After submit', this.page.after),
      '',
    )
    return lines
  }
}

function infoLine(label: string, value: string): string {
  return ' ' + ui.muted(pad(label, 14)) + ' ' + sanitizeAnsi(value)
}

function sentence(value: string): string {
  const text = value.trim()
  if (!text) return text
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function whenFor(kind: string, opts: FieldInfoOpts): string {
  if (opts.advanced) return 'Use this only when the inferred default or standard picker does not match an enterprise or non-standard setup.'
  if (opts.picker) return 'Use the picker when the object already exists; type only when the flow accepts a new value.'
  if (kind === 'select') return 'Choose the option that matches the integration path you are configuring.'
  if (kind === 'file') return 'Use this when the content already exists in a local file.'
  if (kind === 'multiline') return 'Use this when the content is easier to paste or author directly in Console.'
  return 'Use this when the form needs a concrete value before it can continue.'
}

function exampleFor(kind: string, label: string, options?: readonly string[]): string {
  if (kind === 'bool') return 'yes'
  if (kind === 'list') return 'read,write'
  if (kind === 'secret') return '••••'
  if (kind === 'file') return '/home/team/policy.rego'
  if (kind === 'select') return options?.find((option) => option.length > 0) ?? 'Choose one of the listed options.'
  if (label.toLowerCase().includes('url')) return 'https://api.example.com'
  if (label.toLowerCase().includes('identifier')) return 'resource://payments-api'
  if (label.toLowerCase().includes('subject')) return 'user:alice@example.com'
  if (label.toLowerCase().includes('token endpoint')) return 'https://idp.example.com/oauth/token'
  return 'payments-api'
}

function validFor(kind: string, options?: readonly string[]): string {
  if (kind === 'bool') return 'Toggle on or off.'
  if (kind === 'list') return 'Comma-separated values; empty items are ignored.'
  if (kind === 'secret') return 'Paste the exact secret value; it is masked by default.'
  if (kind === 'file') return 'Pick a readable file or enter an absolute path.'
  if (kind === 'select') return `One of: ${(options ?? []).map((option) => option || '<empty>').join(', ')}.`
  if (kind === 'multiline') return 'Plain text content; pasted newlines are preserved.'
  return 'Non-empty text when the field is marked required.'
}
