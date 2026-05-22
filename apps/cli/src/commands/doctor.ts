// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal doctor` reports operator diagnostics for the local Caracal control plane.

import {
  DOCTOR_SECTION_LABELS,
  DOCTOR_SECTION_ORDER,
  doctorShouldFail,
  runDoctorDiagnostics,
  type DoctorCheck,
  type DoctorMode,
  type DoctorReport,
  type DoctorStatus,
} from '@caracalai/engine'
import type { CliConfig } from '../config.ts'
import {
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  showHelp,
} from './shared.ts'
import { style, SYMBOL } from '../style.ts'

function count(checks: DoctorCheck[], status: DoctorStatus): number {
  return checks.filter((c) => c.status === status).length
}

function hasFailed(checks: DoctorCheck[]): boolean {
  return checks.some((c) => c.status === 'fail')
}

function statusText(status: DoctorStatus): string {
  if (status === 'ok') return style.success(`${SYMBOL.ok} ok`.padEnd(8))
  if (status === 'warn') return style.warn(`${SYMBOL.warn} warn`.padEnd(8))
  return style.error(`${SYMBOL.fail} fail`.padEnd(8))
}

function healthLabel(report: DoctorReport): string {
  if (hasFailed(report.checks)) return style.error('unhealthy')
  if (count(report.checks, 'warn') > 0) return style.warn('attention')
  return style.success('healthy')
}

function modeLabel(mode: DoctorMode): string {
  if (mode === 'system') return 'complete system check'
  return 'local preflight only'
}

function uniqueAdvice(checks: DoctorCheck[]): string[] {
  return [...new Set(checks.flatMap((check) => check.advice ? [check.advice] : []))]
}

function printHuman(report: DoctorReport): void {
  process.stdout.write(`${style.title('Caracal doctor')} ${style.label(`(${modeLabel(report.mode)})`)}\n`)
  process.stdout.write(`${style.label('api:')} ${style.code(report.context.apiUrl)}\n`)
  const zones = report.context.zoneIds.length === 0
    ? 'none'
    : report.context.zoneScope === 'all'
      ? `all visible (${report.context.zoneIds.join(', ')})`
      : report.context.zoneIds.join(', ')
  process.stdout.write(`${style.label('zones:')} ${zones === 'none' ? style.label(zones) : style.code(zones)}\n`)
  process.stdout.write(
    `${style.label('summary:')} ${healthLabel(report)} ` +
      `${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail (${report.summary.total} checks)\n`,
  )
  process.stdout.write(`${style.label('readiness:')} ${report.ready ? style.success('ready') : style.warn('not ready')}${report.strict ? style.label(' (strict)') : ''}\n`)

  const width = Math.max(5, ...report.checks.map((c) => c.check.length))
  for (const section of DOCTOR_SECTION_ORDER) {
    const checks = report.checks.filter((c) => c.section === section)
    if (checks.length === 0) continue
    process.stdout.write(`\n${style.header(DOCTOR_SECTION_LABELS[section])}\n`)
    process.stdout.write(`  ${style.header('status'.padEnd(8))}  ${style.header('check'.padEnd(width))}  ${style.header('detail')}\n`)
    for (const check of checks) {
      process.stdout.write(`  ${statusText(check.status)}  ${check.check.padEnd(width)}  ${check.detail}\n`)
    }
  }

  const advice = uniqueAdvice(report.checks)
  if (advice.length > 0) {
    process.stdout.write(`\n${style.header('Next actions')}\n`)
    for (const item of advice) process.stdout.write(`  ${SYMBOL.step} ${item}\n`)
  }
}

export async function doctorCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') return help()
  const { flags } = parseArgs(argv)
  const json = flagBool(flags, 'json')

  let body: DoctorReport
  try {
    body = await runDoctorDiagnostics({
      cfg,
      zoneId: flagString(flags, 'zone'),
      strict: flagBool(flags, 'ready'),
      preflightOnly: flagBool(flags, 'preflight'),
    })
  } catch (err) {
    fail(err)
  }

  if (json) {
    printJSON(body)
  } else {
    printHuman(body)
  }
  if (doctorShouldFail(body)) process.exit(1)
}

function help(): never {
  return showHelp([
    style.header('Usage'),
    `  caracal doctor ${style.label('[--zone <id>] [--preflight] [--ready] [--json]')}`,
    '',
    style.header('Checks'),
    `  ${style.success(SYMBOL.ok)} health, readiness, zones, and local preflight`,
    `  ${SYMBOL.step} no --zone: inspect every visible zone`,
    '',
    style.header('Flags'),
    `  ${style.code('--zone <id>')}    inspect one zone`,
    `  ${style.code('--preflight')}    local config/secrets/dependencies only`,
    `  ${style.code('--ready')}        strict gate: warnings fail readiness`,
    `  ${style.code('--json')}         structured output`,
    '',
    style.label('Exit 1 on failed checks; --ready also exits 1 on warnings.'),
  ])
}
