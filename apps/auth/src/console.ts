// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Session-guarded backend-for-frontend that proxies the Community Edition web client to the Caracal admin API.

import type { IncomingMessage, ServerResponse } from "node:http";
import { discoverAdminToken } from "@caracalai/core";

import { auth } from "./auth.ts";

const API_PREFIX = "/api/console";
const DEFAULT_API_URL = "http://localhost:3000";
const PROBE_TIMEOUT_MS = 2_500;
const PROXY_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 1_000_000;

function apiUrl(): string {
  return (process.env.CARACAL_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

function isLocalUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function adminToken(): string | undefined {
  return discoverAdminToken(undefined, { preferGenerated: isLocalUrl(apiUrl()) });
}

function toWebHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else headers.set(key, value);
  }
  return headers;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request_body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function probeReachable(base: string, token: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/ready`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Reports whether the control plane is configured and reachable so the web
// client can show an honest connection state instead of fabricated data.
async function handleStatus(res: ServerResponse): Promise<void> {
  const base = apiUrl();
  const token = adminToken();
  if (!token) {
    sendJson(res, 200, { configured: false, reachable: false, apiUrl: base });
    return;
  }
  const reachable = await probeReachable(base, token);
  sendJson(res, 200, { configured: true, reachable, apiUrl: base });
}

async function handleProxy(req: IncomingMessage, res: ServerResponse, rest: string): Promise<void> {
  const token = adminToken();
  if (!token) {
    sendJson(res, 503, { error: "control_plane_not_configured" });
    return;
  }
  const target = `${apiUrl()}${rest}`;
  const method = req.method ?? "GET";
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await readBody(req);
    if (body.length > 0) headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: body && body.length > 0 ? body : undefined,
      signal: controller.signal,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(text);
  } catch {
    sendJson(res, 502, { error: "control_plane_unreachable" });
  } finally {
    clearTimeout(timer);
  }
}

// Returns true when the request was a console route and has been handled.
export async function handleConsole(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? "";
  if (!url.startsWith(API_PREFIX)) return false;

  const session = await auth.api.getSession({ headers: toWebHeaders(req) });
  if (!session) {
    sendJson(res, 401, { error: "unauthenticated" });
    return true;
  }

  const path = url.slice(API_PREFIX.length);
  if (path === "/status" || path.startsWith("/status?")) {
    await handleStatus(res);
    return true;
  }
  if (path.startsWith("/v1/")) {
    await handleProxy(req, res, path);
    return true;
  }

  sendJson(res, 404, { error: "not_found" });
  return true;
}
