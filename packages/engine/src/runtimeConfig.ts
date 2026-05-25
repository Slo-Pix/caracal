// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared runtime helpers: caracal.toml discovery and service URL resolution.

import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CaracalError } from '@caracalai/core';

export const DEFAULT_API_URL = 'http://localhost:3000';
export const DEFAULT_COORDINATOR_URL = 'http://localhost:4000';
export const DEFAULT_ZONE_URL = 'http://localhost:8080';

export interface Credential {
  env: string;
  resource: string;
}

export interface OptionalCredential extends Credential {
  on_failure: 'warn' | 'error';
}

export interface McpGovernance {
  mode: 'block' | 'log';
}

export interface RuntimeConfig {
  zone_url: string;
  zone_id: string;
  application_id: string;
  app_client_secret: string;
  continue_on_failure?: boolean;
  credentials?: Credential[];
  optional_credentials?: OptionalCredential[];
  mcp_governance?: McpGovernance;
}

export class RuntimeConfigPermissionError extends CaracalError {
  readonly path: string;
  readonly mode: number;
  constructor(path: string, mode: number, advice: string) {
    super('config_permissions', `caracal.toml permissions are too broad: ${path} is ${formatMode(mode)}; ${advice}`, {
      details: { path, mode: formatMode(mode) },
    });
    this.name = 'RuntimeConfigPermissionError';
    this.path = path;
    this.mode = mode;
  }
}

export function defaultRuntimeConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0
    ? env.XDG_CONFIG_HOME
    : join(homedir(), '.config');
  return join(xdg, 'caracal', 'caracal.toml');
}

// Resolves the path to caracal.toml using the documented precedence:
//   $CARACAL_CONFIG → $XDG_CONFIG_HOME/caracal/caracal.toml
// Returns undefined when no candidate exists on disk.
export function resolveRuntimeConfigPath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.CARACAL_CONFIG) return existsSync(env.CARACAL_CONFIG) ? env.CARACAL_CONFIG : undefined;
  const path = defaultRuntimeConfigPath(env);
  return existsSync(path) ? path : undefined;
}

export function assertRuntimeConfigFileSecure(path: string, env: NodeJS.ProcessEnv = process.env): void {
  if (process.platform === 'win32') return;
  const mode = statSync(path).mode & 0o777;
  if (env.CARACAL_CONFIG === path) {
    if ((mode & 0o022) !== 0) {
      throw new RuntimeConfigPermissionError(path, mode, `remove group/world write bits from ${path}`);
    }
    return;
  }
  if ((mode & 0o077) !== 0) {
    throw new RuntimeConfigPermissionError(path, mode, `run chmod 600 ${path}`);
  }
}

function formatMode(mode: number): string {
  return '0o' + mode.toString(8).padStart(3, '0');
}

export class ServiceUrlMissingError extends CaracalError {
  readonly envKey: string;
  readonly nodeEnv: string;
  constructor(envKey: string, nodeEnv: string) {
    super('config_missing', `${envKey} is required when NODE_ENV=${nodeEnv}`, {
      details: { envKey, nodeEnv },
    });
    this.name = 'ServiceUrlMissingError';
    this.envKey = envKey;
    this.nodeEnv = nodeEnv;
  }
}

// Returns the env-var override or the dev default. Throws ServiceUrlMissingError
// in non-development so misconfigured production management never silently hits localhost.
export function resolveServiceUrl(envKey: string, devDefault: string): string {
  const v = process.env[envKey];
  if (v) return v;
  const env = process.env.NODE_ENV ?? 'development';
  if (env !== 'development') {
    throw new ServiceUrlMissingError(envKey, env);
  }
  return devDefault;
}
