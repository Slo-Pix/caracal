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
  impact?: string
  example?: string
  valid: string
  after: string
  context?: readonly InfoPair[]
  terms?: readonly InfoPair[]
  notes?: readonly string[]
}

export interface InfoPair {
  label: string
  value: string
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
    meaning: hint ? sentence(hint) : `${title} supplies the value used by the current Console workflow.`,
    when: whenFor(kind, opts),
    impact: impactFor(kind, title),
    example: exampleFor(kind, title, opts.options),
    valid: `${required} ${validFor(kind, opts.options)}`,
    after: opts.advanced
      ? 'After saving advanced options, Console keeps this value on the parent form and sends it only when you submit.'
      : 'After submit, Console sends this value to the Control API and shows the result or validation error.',
    context: opts.dependency ? [{ label: 'Visibility', value: opts.dependency }] : undefined,
    terms: termsFor(title),
  }
}

export function actionInfo(label: string, after = 'After confirmation, Console sends the request and refreshes the current view.'): InfoPage {
  const normalized = label.toLowerCase()
  return {
    title: label,
    meaning: actionMeaning(normalized, label),
    when: actionWhen(normalized),
    impact: actionImpact(normalized),
    example: label.toLowerCase().includes('create') ? 'Create PiperNet resource' : label,
    valid: 'The action is valid when required fields are complete and selected objects still exist.',
    after,
    notes: actionNotes(normalized),
  }
}

export function openInfo(app: App, page: InfoPage | undefined): void {
  if (!page) {
    app.setStatus('no contextual help is available for this item', 'error')
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
    const body = this.bodyLines(ctx.size.cols)
    return body.slice(this.offset, this.offset + ctx.size.rows)
  }

  onKey(key: Key, ctx: ViewContext): void {
    const max = Math.max(0, this.bodyLines(ctx.size.cols).length - ctx.size.rows)
    if (key === 'up' || key === 'k') { this.offset = Math.max(0, this.offset - 1); return }
    if (key === 'down' || key === 'j') { this.offset = Math.min(max, this.offset + 1); return }
    if (key === 'esc' || key === 'left') ctx.app.pop()
  }

  private bodyLines(width: number): string[] {
    const lines = [
      '',
      ' ' + ui.title(this.page.title),
      '',
      ...infoLine('Means', this.page.meaning, width),
      ...infoLine('Use when', this.page.when, width),
    ]
    if (this.page.impact) lines.push(...infoLine('Impact', this.page.impact, width))
    if (this.page.context?.length) {
      lines.push('', ' ' + ui.accent('Context'))
      for (const item of this.page.context) lines.push(...infoLine(item.label, item.value, width))
    }
    if (this.page.terms?.length) {
      lines.push('', ' ' + ui.accent('Terms'))
      for (const item of this.page.terms) lines.push(...infoLine(item.label, item.value, width))
    }
    if (this.page.example) lines.push(...infoLine('Example', this.page.example, width))
    lines.push(
      ...infoLine('Valid input', this.page.valid, width),
      ...infoLine('After submit', this.page.after, width),
      '',
    )
    if (this.page.notes?.length) {
      lines.push(' ' + ui.accent('Operational notes'))
      for (const note of this.page.notes) lines.push(...wrapped(` - ${sanitizeAnsi(note)}`, width, 3))
      lines.push('')
    }
    return lines
  }
}

function infoLine(label: string, value: string, width: number): string[] {
  const prefix = ' ' + ui.muted(pad(label, 14)) + ' '
  const bodyWidth = Math.max(24, width - 17)
  return wrapText(sanitizeAnsi(value), bodyWidth).map((line, index) => index === 0
    ? prefix + line
    : ' ' + ui.muted(pad('', 14)) + ' ' + line)
}

function wrapped(value: string, width: number, indent: number): string[] {
  return wrapText(value, Math.max(24, width - indent)).map((line, index) => ' '.repeat(index === 0 ? indent : indent + 2) + line)
}

function wrapText(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line.length === 0) {
      line = word
    } else if (line.length + 1 + word.length <= width) {
      line += ' ' + word
    } else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
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

function impactFor(kind: string, title: string): string {
  const label = title.toLowerCase()
  if (label.includes('scope')) return 'Scopes bound here constrain what tokens, grants, or policies may authorize later.'
  if (label.includes('identifier')) return 'Identifiers are stable API-facing names; changing them can affect clients and automation.'
  if (label.includes('secret') || kind === 'secret') return 'Secrets are copied into requests exactly as pasted and are hidden in the terminal by default.'
  if (label.includes('token endpoint')) return 'Token endpoints are contacted when Caracal exchanges or refreshes upstream credentials.'
  if (label.includes('upstream')) return 'Upstream values affect where Gateway sends protected traffic.'
  if (kind === 'bool') return 'This toggles behavior in the API request; leave unchanged unless you intend that behavior change.'
  if (kind === 'file') return 'Console reads the file once at submit time; later file edits do not change the saved object.'
  return 'This value is sent as part of the API request for the current workflow.'
}

function termsFor(title: string): InfoPair[] | undefined {
  const label = title.toLowerCase()
  const terms: InfoPair[] = []
  if (label.includes('dcr') || label.includes('dynamic client')) terms.push({ label: 'DCR', value: 'Dynamic Client Registration; lets an app be registered through the API when the zone enables it.' })
  if (label.includes('scope')) terms.push({ label: 'Scope', value: 'A named permission string requested in a token and evaluated by grants and policies.' })
  if (label.includes('resource')) terms.push({ label: 'Resource', value: 'The protected API, service, audience, or Gateway target being accessed.' })
  if (label.includes('provider')) terms.push({ label: 'Provider', value: 'An upstream identity or credential source Caracal can use for protected calls.' })
  if (label.includes('policy')) terms.push({ label: 'Policy', value: 'Authorization logic that evaluates requests and returns allow, deny, or partial decisions.' })
  if (label.includes('grant')) terms.push({ label: 'Grant', value: 'A binding that lets one subject use one application against selected resource scopes.' })
  if (label.includes('session')) terms.push({ label: 'Session', value: 'A tracked authority context used for token exchange, delegation, or agent activity.' })
  return terms.length > 0 ? terms : undefined
}

function actionMeaning(normalized: string, label: string): string {
  if (normalized.includes('create') || normalized.includes('new')) return 'Creates a new Control API object using the values in the current form.'
  if (normalized.includes('edit') || normalized.includes('patch')) return 'Changes the selected object by sending only the submitted fields.'
  if (normalized.includes('delete')) return 'Archives or removes the selected object through the Control API.'
  if (normalized.includes('validate')) return 'Checks policy or configuration input without making it active.'
  if (normalized.includes('simulate')) return 'Runs a dry evaluation so you can inspect the decision before changing live behavior.'
  if (normalized.includes('activate')) return 'Makes a selected version the effective policy set used for authorization decisions.'
  if (normalized.includes('revoke')) return 'Stops a grant, delegation, token, or key from being used again.'
  if (normalized.includes('rotate')) return 'Issues replacement credentials while keeping the managed object identity.'
  if (normalized.includes('credential')) return 'Opens a credential workflow for reading or inspecting protected-resource tokens.'
  if (normalized.includes('control')) return 'Opens a Control service workflow for automation keys, tokens, or lifecycle state.'
  return `${label} opens the focused Console workflow for the current page.`
}

function actionWhen(normalized: string): string {
  if (normalized.includes('delete') || normalized.includes('revoke')) return 'Use it only after confirming the selected object is no longer needed or should lose authority.'
  if (normalized.includes('rotate')) return 'Use it when a secret may be exposed, is expiring, or needs scheduled replacement.'
  if (normalized.includes('validate') || normalized.includes('simulate')) return 'Use it before activating or saving changes that could affect authorization.'
  if (normalized.includes('create') || normalized.includes('new')) return 'Use it when the object does not already exist in the selected zone.'
  return 'Use it after reviewing the visible values and any advanced settings that apply.'
}

function actionImpact(normalized: string): string {
  if (normalized.includes('delete')) return 'The object disappears from normal Console lists and dependent workflows may fail if they still reference it.'
  if (normalized.includes('revoke')) return 'Existing authority is terminated or made unusable for future requests.'
  if (normalized.includes('activate')) return 'New authorization decisions use the activated policy-set version.'
  if (normalized.includes('simulate') || normalized.includes('validate')) return 'No production state changes; the result is informational.'
  if (normalized.includes('rotate')) return 'The new secret must be stored by the operator because it may not be retrievable later.'
  return 'Console sends an API request and reports the result or validation error.'
}

function actionNotes(normalized: string): string[] | undefined {
  if (normalized.includes('delete') || normalized.includes('revoke')) return ['Prefer copy-page on the detail view first if you need a record of the exact object.', 'If the API rejects the action, Console leaves the current view unchanged.']
  if (normalized.includes('rotate')) return ['Copy the one-time secret immediately and update dependent clients before discarding the result page.']
  return undefined
}

function exampleFor(kind: string, label: string, options?: readonly string[]): string {
  if (kind === 'bool') return 'yes'
  if (kind === 'list') return 'read,write'
  if (kind === 'secret') return '••••'
  if (kind === 'file') return '/home/richard/pied-piper/policies/pipernet.rego'
  if (kind === 'select') return options?.find((option) => option.length > 0) ?? 'Choose one of the listed options.'
  if (label.toLowerCase().includes('token endpoint')) return 'https://login.hooli.example/oauth/token'
  if (label.toLowerCase().includes('url')) return 'https://api.pipernet.example'
  if (label.toLowerCase().includes('identifier')) return 'resource://pipernet'
  if (label.toLowerCase().includes('subject')) return 'user:richard.hendricks@piedpiper.example'
  return 'Son of Anton'
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
