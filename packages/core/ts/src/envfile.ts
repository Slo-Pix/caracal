// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Helpers for reading dotenv files and discovering the Caracal admin token.

import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2]!;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]!] = value;
  }
  return out;
}

/**
 * Resolve the runtime home written to by `caracal up` in installed mode.
 * Mirrors the layout in apps/cli/src/runtime/install.ts so consumers
 * outside the CLI (SDK helpers, tests, scripts) reach the same file.
 */
export function runtimeEnvFile(): string {
  if (process.env.CARACAL_HOME) return join(process.env.CARACAL_HOME, '.env');
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'caracal', '.env');
  }
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.local', 'share');
  return join(base, 'caracal', '.env');
}

export function discoverAdminToken(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (process.env.CARACAL_ADMIN_TOKEN) return process.env.CARACAL_ADMIN_TOKEN;
  const candidates = [
    process.env.CARACAL_ENV_FILE,
    runtimeEnvFile(),
    join(process.cwd(), '.env'),
    join(process.cwd(), 'infra', 'docker', '.env'),
  ].filter((p): p is string => Boolean(p));
  for (const path of candidates) {
    const env = readEnvFile(path);
    if (env.CARACAL_ADMIN_TOKEN) return env.CARACAL_ADMIN_TOKEN;
  }
  return undefined;
}
