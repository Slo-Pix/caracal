// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Structured JSON logger for TypeScript services.

import { hostname } from 'node:os';
import type { Writable } from 'node:stream';

type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_VALUE: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

/**
 * Field names whose values must never appear in dev logs. Mirror this list in
 * packages/core/go/logging/redact.go and packages/core/python/caracalai_core/logging.py.
 */
export const SECRET_KEYS: readonly string[] = Object.freeze([
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'api_key',
  'client_secret',
  'private_key',
  'session',
  'assertion',
  'authorization',
  'cookie',
  'set_cookie',
  'set-cookie',
  'hmac',
  'signature',
]);

export const REDACT_VALUE = '***';

const BEARER_PATTERN = /bearer\s+[A-Za-z0-9._\-+/=]{8,}/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

export function isSecretKey(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_KEYS.some((k) => lower.includes(k));
}

/**
 * Scrub Bearer tokens and JWT-shaped substrings from a string. Cheap on the
 * common path: returns the original reference when no pattern matches.
 */
export function redactString(s: string): string {
  if (s.length < 16) return s;
  let out = s.replace(BEARER_PATTERN, `Bearer ${REDACT_VALUE}`);
  out = out.replace(JWT_PATTERN, REDACT_VALUE);
  return out;
}

function serializeError(err: Error): Record<string, unknown> {
  const out: Record<string, unknown> = { name: err.name, message: err.message };
  if (err.stack) out.stack = err.stack;
  const code = (err as Error & { code?: unknown }).code;
  if (code !== undefined) out.code = code;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause !== undefined) out.cause = cause instanceof Error ? serializeError(cause) : cause;
  return out;
}

/**
 * Returns a deep copy of `value` with any field whose key matches SECRET_KEYS
 * replaced with REDACT_VALUE, string values scrubbed of token-like patterns,
 * and Error instances flattened to plain JSON-friendly objects.
 */
export function redact<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value) as unknown as T;
  if (value instanceof Error) return serializeError(value) as unknown as T;
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSecretKey(k) ? REDACT_VALUE : redact(v);
  }
  return out as T;
}

export type Logger = {
  level: Level;
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  fatal: (msg: string, fields?: Record<string, unknown>) => void;
  with: (fields: Record<string, unknown>) => Logger;
};

export interface CreateLoggerOptions {
  level?: Level;
  hostname?: string;
  pid?: number;
  version?: string;
  env?: string;
  stream?: Writable;
}

let cachedHostname: string | null = null;
function host(): string {
  if (cachedHostname === null) {
    try { cachedHostname = hostname(); } catch { cachedHostname = 'unknown'; }
  }
  return cachedHostname;
}

function processBaseFields(): Record<string, unknown> {
  return {
    hostname: host(),
    pid: process.pid,
    version: process.env.CARACAL_VERSION || process.env.npm_package_version || 'dev',
    env: process.env.CARACAL_ENV || process.env.NODE_ENV || 'development',
  };
}

function envLevel(): Level {
  const raw = (process.env.CARACAL_LOG_LEVEL || process.env.LOG_LEVEL || '').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error' || raw === 'fatal') return raw;
  return 'info';
}

export function createLogger(service: string, levelOrOpts?: Level | CreateLoggerOptions): Logger {
  const opts: CreateLoggerOptions = typeof levelOrOpts === 'string' ? { level: levelOrOpts } : (levelOrOpts ?? {});
  const level: Level = opts.level ?? envLevel();
  const baseFields: Record<string, unknown> = {
    service,
    ...processBaseFields(),
    ...(opts.hostname !== undefined ? { hostname: opts.hostname } : {}),
    ...(opts.pid !== undefined ? { pid: opts.pid } : {}),
    ...(opts.version !== undefined ? { version: opts.version } : {}),
    ...(opts.env !== undefined ? { env: opts.env } : {}),
  };
  return makeLogger(baseFields, level, opts.stream ?? process.stderr);
}

function makeLogger(
  bound: Record<string, unknown>,
  level: Level,
  stream: NodeJS.WritableStream,
): Logger {
  const threshold = LEVEL_VALUE[level];
  const emit = (msgLevel: Level, msg: string, fields?: Record<string, unknown>): void => {
    if (LEVEL_VALUE[msgLevel] < threshold) return;
    const safe = fields ? (redact(fields) as Record<string, unknown>) : undefined;
    stream.write(
      JSON.stringify({
        level: msgLevel,
        time: new Date().toISOString(),
        ...bound,
        msg,
        ...safe,
      }) + '\n',
    );
  };
  return {
    level,
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    fatal: (msg, fields) => emit('fatal', msg, fields),
    with: (fields) => makeLogger({ ...bound, ...(redact(fields) as Record<string, unknown>) }, level, stream),
  };
}


