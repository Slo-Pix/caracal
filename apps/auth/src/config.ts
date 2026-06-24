// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Runtime configuration for the Community Edition authentication service.

import { resolveFileSecrets } from "@caracalai/core";

// Postgres TLS posture. "disable" relies on the connection string (default for the local
// stack), "require" enforces a verified certificate, and "no-verify" enables TLS without
// certificate verification for managed providers that present self-signed chains.
export type PostgresSsl = "disable" | "require" | "no-verify";

export interface AuthConfig {
  port: number;
  baseURL: string;
  secret: string;
  webOrigin: string;
  databaseUrl: string;
  ssl: PostgresSsl;
}

function resolveDatabaseUrl(): string {
  // CARACAL_AUTH_DATABASE_URL isolates the auth schema in its own database; DATABASE_URL is
  // the platform-wide fallback. Both honour the `_FILE` secret convention.
  resolveFileSecrets(["CARACAL_AUTH_DATABASE_URL", "DATABASE_URL"]);
  const url = process.env.CARACAL_AUTH_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "CARACAL_AUTH_DATABASE_URL is required. The auth service runs on PostgreSQL; start the stack with `caracal up` for local development, or set CARACAL_AUTH_DATABASE_URL (or CARACAL_AUTH_DATABASE_URL_FILE) to a Postgres connection string.",
    );
  }
  return url.trim();
}

function resolveSsl(): PostgresSsl {
  const value = (process.env.CARACAL_AUTH_DATABASE_SSL ?? "").toLowerCase();
  if (value === "require" || value === "true" || value === "verify") return "require";
  if (value === "no-verify" || value === "insecure") return "no-verify";
  return "disable";
}

function resolveSecret(): string {
  resolveFileSecrets(["CARACAL_AUTH_SECRET"]);
  const secret = process.env.CARACAL_AUTH_SECRET;
  // The signing secret protects every session cookie; a predictable value lets anyone forge
  // sessions. It is provisioned automatically for local development and required everywhere
  // else, so fail closed rather than run without one.
  if (!secret || secret.trim() === "") {
    throw new Error(
      "CARACAL_AUTH_SECRET is required. It is provisioned automatically by `caracal web`; for other deployments set CARACAL_AUTH_SECRET (or CARACAL_AUTH_SECRET_FILE) to a high-entropy random value.",
    );
  }
  return secret.trim();
}

export function loadConfig(): AuthConfig {
  const port = Number(process.env.CARACAL_AUTH_PORT ?? 3002);
  const baseURL = process.env.CARACAL_AUTH_URL ?? `http://localhost:${port}`;
  const webOrigin = process.env.CARACAL_WEB_ORIGIN ?? "http://localhost:3001";
  return {
    port,
    baseURL,
    webOrigin,
    databaseUrl: resolveDatabaseUrl(),
    ssl: resolveSsl(),
    secret: resolveSecret(),
  };
}
