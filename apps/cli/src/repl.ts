// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Interactive command shell for `caracal cli` (no args): controlled REPL with allowlisted dispatch, history, and inline dropdown autocomplete.

import { createInterface, emitKeypressEvents, type Interface } from 'node:readline'
import { COMMAND_NAME_PATTERN } from '@caracalai/core/commands'
import { style, printError, printInfo, colorOn, highlightMatch } from './style.ts'
import type { CommandRegistry } from './registry.ts'
import type { CliConfig } from './config.ts'
import { printUsage, type DispatchOptions } from './dispatcher.ts'
import { complete, type Suggestion } from './complete.ts'

export interface ReplOptions {
  readonly dispatchOptions: DispatchOptions
  readonly cfg?: CliConfig
}

function splitArgs(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let esc = false
  for (const ch of line) {
    if (esc) { cur += ch; esc = false; continue }
    if (ch === '\\' && !quote) { esc = true; continue }
    if (quote) {
      if (ch === quote) { quote = null; continue }
      cur += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (/\s/.test(ch)) {
      if (cur) { out.push(cur); cur = '' }
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const BUILTINS = [
  { value: 'help', summary: 'Show command list' },
  { value: 'clear', summary: 'Clear the screen' },
  { value: 'exit', summary: 'Exit the REPL' },
  { value: 'quit', summary: 'Exit the REPL' },
] as const

class ReplExit extends Error {
  readonly code: number
  constructor(code: number) {
    super(`repl-exit:${code}`)
    this.code = code
  }
}

interface DropdownState {
  suggestions: Suggestion[]
  selected: number
  rendered: number
}

export async function startRepl(opts: ReplOptions): Promise<void> {
  if (!process.stdin.isTTY) {
    printError(`${opts.dispatchOptions.binary}: interactive shell requires a TTY (pass a command, e.g. \`${opts.dispatchOptions.binary} status\`)`)
    process.exit(1)
  }
  const { registry } = opts.dispatchOptions
  const useDropdown = colorOn(process.stdout)
  const promptText = `${style.prompt('caracal')}${style.label(' › ')}`
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptText,
    completer: useDropdown ? undefined : buildSimpleCompleter(registry),
    terminal: true,
    historySize: 500,
  })

  const dropdown: DropdownState = { suggestions: [], selected: 0, rendered: 0 }
  if (useDropdown) attachDropdown(rl, registry, opts.cfg, dropdown)

  printInfo(`Caracal CLI ${opts.dispatchOptions.version} — interactive shell. Type \`help\` for commands, \`exit\` to quit.`)
  if (useDropdown) printInfo(`${style.kbd(' Tab ')} accept   ${style.kbd(' ↑↓ ')} navigate   ${style.kbd(' Esc ')} dismiss`)
  rl.prompt()

  let exitCode = 0
  for await (const raw of rl) {
    clearDropdown(dropdown)
    const line = raw.trim()
    if (!line) { rl.prompt(); continue }
    const args = splitArgs(line)
    const cmd = args[0]
    if (cmd === 'exit' || cmd === 'quit') { rl.close(); break }
    if (cmd === 'clear') { process.stdout.write('\x1b[2J\x1b[H'); rl.prompt(); continue }
    if (cmd === 'help' || cmd === '--help' || cmd === '-h' || cmd === '?') {
      printUsage(opts.dispatchOptions, process.stdout)
      rl.prompt()
      continue
    }
    if (!cmd || !COMMAND_NAME_PATTERN.test(cmd) || !registry.byName.has(cmd) || registry.byName.get(cmd)!.descriptor.hidden) {
      printError(`unknown command: ${cmd ?? ''} (type \`help\`)`)
      rl.prompt()
      continue
    }
    const binding = registry.byName.get(cmd)!
    const origExit = process.exit
    process.exit = ((code?: number) => { throw new ReplExit(code ?? 0) }) as typeof process.exit
    try {
      await binding.run(args.slice(1), opts.cfg)
    } catch (err) {
      if (err instanceof ReplExit) {
        if (err.code !== 0) exitCode = err.code
      } else {
        exitCode = 1
        printError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      process.exit = origExit
    }
    rl.prompt()
  }
  process.stdout.write('\n')
  if (exitCode !== 0) process.exit(exitCode)
}

function buildSimpleCompleter(registry: CommandRegistry): (line: string) => [string[], string] {
  const visible = registry.ordered.filter((b) => !b.descriptor.hidden).map((b) => b.descriptor.name)
  const all = [...new Set([...visible, ...BUILTINS.map((b) => b.value)])].sort()
  return (line: string): [string[], string] => {
    const trimmed = line.trimStart()
    const firstSpace = trimmed.indexOf(' ')
    if (firstSpace === -1) {
      const hits = all.filter((c) => c.startsWith(trimmed))
      return [hits.length ? hits : all, trimmed]
    }
    return [[], line]
  }
}

function attachDropdown(
  rl: Interface,
  registry: CommandRegistry,
  cfg: CliConfig | undefined,
  state: DropdownState,
): void {
  emitKeypressEvents(process.stdin, rl)
  const refresh = () => {
    const line = (rl as unknown as { line: string }).line ?? ''
    const cursor = (rl as unknown as { cursor: number }).cursor ?? line.length
    const result = complete(registry, line, cursor, {
      cfg,
      hasZone: hasZone(cfg),
      builtins: BUILTINS,
      limit: 8,
    })
    state.suggestions = result.suggestions
    if (state.selected >= state.suggestions.length) state.selected = 0
    renderDropdown(state)
  }
  process.stdin.on('keypress', (_ch: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean } | undefined) => {
    if (!key) return
    if (key.ctrl && (key.name === 'c' || key.name === 'd')) { clearDropdown(state); return }
    if (key.name === 'tab') {
      if (state.suggestions.length > 0) {
        applySelection(rl, registry, cfg, state)
        return
      }
    }
    if (key.name === 'up' && state.suggestions.length > 0) {
      state.selected = (state.selected - 1 + state.suggestions.length) % state.suggestions.length
      renderDropdown(state)
      return
    }
    if (key.name === 'down' && state.suggestions.length > 0) {
      state.selected = (state.selected + 1) % state.suggestions.length
      renderDropdown(state)
      return
    }
    if (key.name === 'escape') { clearDropdown(state); return }
    if (key.name === 'return' || key.name === 'enter') return
    setImmediate(refresh)
  })
}

function applySelection(
  rl: Interface,
  registry: CommandRegistry,
  cfg: CliConfig | undefined,
  state: DropdownState,
): void {
  const sug = state.suggestions[state.selected]
  if (!sug || sug.disabled) return
  const internal = rl as unknown as { line: string; cursor: number; _refreshLine?: () => void }
  const line = internal.line ?? ''
  const cursor = internal.cursor ?? line.length
  const res = complete(registry, line, cursor, { cfg, hasZone: hasZone(cfg), builtins: BUILTINS, limit: 1 })
  const before = line.slice(0, res.tokenStart)
  const after = line.slice(res.tokenEnd)
  const insert = sug.value + (sug.kind === 'command' || sug.kind === 'subcommand' ? ' ' : '')
  internal.line = before + insert + after
  internal.cursor = before.length + insert.length
  if (typeof internal._refreshLine === 'function') internal._refreshLine()
  state.suggestions = []
  state.selected = 0
  clearDropdown(state)
}

function renderDropdown(state: DropdownState): void {
  clearDropdown(state)
  if (state.suggestions.length === 0) return
  const out = process.stdout
  const lines: string[] = []
  const maxNameLen = Math.min(28, Math.max(...state.suggestions.map((s) => s.value.length)))
  for (let i = 0; i < state.suggestions.length; i++) {
    const s = state.suggestions[i]!
    const highlighted = highlightMatch(s.value, s.matchStart, s.matchLength)
    const padding = ' '.repeat(Math.max(1, maxNameLen + 2 - s.value.length))
    const summary = s.disabled
      ? style.dim(`${s.summary} · ${s.disabledReason ?? 'unavailable'}`)
      : style.dim(s.summary)
    const kindTag = style.dim(`[${s.kind[0]}]`)
    const row = `${kindTag} ${highlighted}${padding}${summary}`
    lines.push(i === state.selected ? `${style.accent('▸')} ${style.selected(' ' + s.value + ' ')} ${style.dim(s.summary)}` : `  ${row}`)
  }
  out.write('\x1b7')
  for (const ln of lines) out.write('\n' + ln + '\x1b[K')
  out.write(`\x1b[${lines.length}A\x1b8`)
  state.rendered = lines.length
}

function clearDropdown(state: DropdownState): void {
  if (state.rendered <= 0) return
  const out = process.stdout
  out.write('\x1b7')
  for (let i = 0; i < state.rendered; i++) out.write('\n\x1b[2K')
  out.write(`\x1b[${state.rendered}A\x1b8`)
  state.rendered = 0
}

function hasZone(cfg: CliConfig | undefined): boolean {
  if (!cfg) return false
  const zone = (cfg as unknown as { zone_id?: string }).zone_id
  return Boolean(zone) || Boolean(process.env.CARACAL_ZONE_ID)
}
