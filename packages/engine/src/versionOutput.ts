// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Structured Console rendering for Caracal binary version metadata.

const RESET = '\x1b[0m'

const SGR = {
  title: '\x1b[1;35m',
  label: '\x1b[2m',
  value: '\x1b[36m',
  mode: '\x1b[1;36m',
} as const

type Tone = keyof typeof SGR

export interface VersionInfo {
  readonly binary: string
  readonly version: string
  readonly mode: 'dev' | 'rc' | 'stable'
  readonly sha: string
}

function envFlag(name: string): boolean {
  const v = process.env[name]
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false'
}

function colorEnabled(stream: NodeJS.WriteStream): boolean {
  if (envFlag('NO_COLOR')) return false
  if (envFlag('CARACAL_NO_COLOR')) return false
  if (envFlag('FORCE_COLOR') || envFlag('CARACAL_COLOR')) return true
  return Boolean(stream.isTTY)
}

function paint(stream: NodeJS.WriteStream, tone: Tone, text: string): string {
  if (!colorEnabled(stream)) return text
  return `${SGR[tone]}${text}${RESET}`
}

function row(stream: NodeJS.WriteStream, label: string, value: string, tone: Tone = 'value'): string {
  return `  ${paint(stream, 'label', label.padEnd(8))} ${paint(stream, tone, value)}`
}

export function formatVersionOutput(info: VersionInfo, stream: NodeJS.WriteStream = process.stdout): string {
  return [
    paint(stream, 'title', 'Caracal'),
    row(stream, 'binary', info.binary),
    row(stream, 'version', info.version),
    row(stream, 'mode', info.mode, 'mode'),
    row(stream, 'sha', info.sha),
    '',
  ].join('\n')
}
