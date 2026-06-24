// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Session-guarded backend-for-frontend that proxies the Community Edition web client to the Caracal admin API.

import type { IncomingMessage, ServerResponse } from "node:http";
import { discoverAdminToken, discoverCoordinatorToken } from "@caracalai/core";
import { runDoctorDiagnostics, type DoctorReport } from "@caracalai/engine";

import { auth } from "./auth.ts";

const API_PREFIX = "/api/console";
const COORD_PREFIX = "/api/console/coord";
const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_COORDINATOR_URL = "http://localhost:4000";
const PROBE_TIMEOUT_MS = 2_500;
const PROXY_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 1_000_000;

function apiUrl(): string {
  return (process.env.CARACAL_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

function coordinatorUrl(): string {
  return (process.env.CARACAL_COORDINATOR_URL ?? DEFAULT_COORDINATOR_URL).replace(/\/$/, "");
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

function coordinatorToken(): string | undefined {
  return discoverCoordinatorToken(undefined, { preferGenerated: isLocalUrl(coordinatorUrl()) });
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

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

// A single page load fires many parallel console requests carrying the same session
// cookie, and each getSession() is a Postgres round-trip. Validation is therefore cached
// per cookie for a short window and concurrent lookups are de-duplicated onto one promise,
// collapsing N auth round-trips into one. The TTL is intentionally short so revoked or
// expired sessions stop working within seconds; the upstream control plane still enforces
// its own admin token, so this gate only answers "is this operator signed in".
const SESSION_TTL_MS = 3_000;
const SESSION_CACHE_MAX = 1_000;
const sessionCache = new Map<string, { at: number; session: SessionResult }>();
const sessionInFlight = new Map<string, Promise<SessionResult>>();

async function validateSession(req: IncomingMessage): Promise<SessionResult> {
  const cookie = req.headers.cookie;
  if (!cookie) return auth.api.getSession({ headers: toWebHeaders(req) });

  const now = Date.now();
  const cached = sessionCache.get(cookie);
  if (cached && now - cached.at < SESSION_TTL_MS) return cached.session;

  const existing = sessionInFlight.get(cookie);
  if (existing) return existing;

  const lookup = auth.api
    .getSession({ headers: toWebHeaders(req) })
    .then((session) => {
      if (sessionCache.size >= SESSION_CACHE_MAX) {
        for (const key of sessionCache.keys()) {
          sessionCache.delete(key);
          if (sessionCache.size < SESSION_CACHE_MAX) break;
        }
      }
      sessionCache.set(cookie, { at: Date.now(), session });
      return session;
    })
    .finally(() => {
      sessionInFlight.delete(cookie);
    });
  sessionInFlight.set(cookie, lookup);
  return lookup;
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
// client can show an honest connection state instead of fabricated data. The two
// readiness probes run concurrently and the result is cached briefly so repeated
// navigations and the navbar indicator do not each pay two network round-trips.
const STATUS_TTL_MS = 3_000;
let statusCache: { at: number; payload: Record<string, unknown> } | undefined;
let statusInFlight: Promise<Record<string, unknown>> | undefined;

async function computeStatus(): Promise<Record<string, unknown>> {
  const base = apiUrl();
  const token = adminToken();
  const coordBase = coordinatorUrl();
  const coordTok = coordinatorToken();
  const coordinatorConfigured = Boolean(coordTok);
  const [reachable, coordinatorReachable] = await Promise.all([
    token ? probeReachable(base, token) : Promise.resolve(false),
    coordTok ? probeReachable(coordBase, coordTok) : Promise.resolve(false),
  ]);
  return {
    configured: Boolean(token),
    reachable: Boolean(token) && reachable,
    apiUrl: base,
    coordinatorConfigured,
    coordinatorReachable,
    coordinatorUrl: coordBase,
  };
}

async function handleStatus(res: ServerResponse): Promise<void> {
  const now = Date.now();
  if (!statusCache || now - statusCache.at >= STATUS_TTL_MS) {
    if (!statusInFlight) {
      statusInFlight = computeStatus().finally(() => {
        statusInFlight = undefined;
      });
    }
    try {
      statusCache = { at: Date.now(), payload: await statusInFlight };
    } catch {
      sendJson(res, 200, { configured: false, reachable: false, apiUrl: apiUrl() });
      return;
    }
  }
  sendJson(res, 200, statusCache.payload);
}

// Full control-plane diagnostics: the same checks the Console `doctor` runs, surfaced
// to the web client so platform health lives in one place. The report is comparatively
// expensive (it probes every service and walks each zone), so a short in-process cache
// absorbs the navbar's background polling without hammering the control plane.
const DIAGNOSTICS_TTL_MS = 8_000;
interface DiagnosticsCacheEntry {
  at: number;
  generation: number;
  payload: DoctorReport & { generatedAt: string };
}
const diagnosticsCache = new Map<string, DiagnosticsCacheEntry>();
const diagnosticsInFlight = new Map<string, Promise<DiagnosticsCacheEntry>>();
// The report is derived from the control-plane state (zones, resources, policies, …). Any
// mutation through this proxy can change it, so a monotonic generation lets a write
// invalidate every cached/in-flight report: a computation that started before the change is
// neither served as fresh nor stored, forcing the next read to recompute against current state.
let diagnosticsGeneration = 0;

// Invalidate all diagnostics state after a control-plane mutation so the next read reflects
// the change immediately instead of waiting out the freshness window.
function invalidateDiagnostics(): void {
  diagnosticsGeneration += 1;
  diagnosticsCache.clear();
  diagnosticsInFlight.clear();
}

interface DiagnosticsOptions {
  zoneId?: string;
  strict: boolean;
  preflightOnly: boolean;
}

function parseDiagnosticsOptions(path: string): DiagnosticsOptions {
  const query = path.includes("?") ? new URLSearchParams(path.slice(path.indexOf("?") + 1)) : new URLSearchParams();
  return {
    zoneId: query.get("zone") ?? undefined,
    strict: query.get("strict") === "true",
    preflightOnly: query.get("mode") === "preflight",
  };
}

function diagnosticsCacheKey(options: DiagnosticsOptions): string {
  return `${options.preflightOnly ? "preflight" : "system"}:${options.strict ? "strict" : "lax"}:${options.zoneId ?? "all"}`;
}

async function computeDiagnostics(options: DiagnosticsOptions): Promise<DiagnosticsCacheEntry> {
  // Capture the generation at the start of the read; if a mutation bumps it before the
  // report finishes, the result is considered stale and is dropped by the caller.
  const generation = diagnosticsGeneration;
  const report = await runDoctorDiagnostics({
    zoneId: options.preflightOnly ? undefined : options.zoneId,
    strict: options.strict,
    preflightOnly: options.preflightOnly,
  });
  const generatedAt = new Date().toISOString();
  return { at: Date.now(), generation, payload: { ...report, generatedAt } };
}

async function handleDiagnostics(res: ServerResponse, path: string): Promise<void> {
  if (!adminToken()) {
    sendJson(res, 503, { error: "control_plane_not_configured" });
    return;
  }
  const options = parseDiagnosticsOptions(path);
  const key = diagnosticsCacheKey(options);
  const cached = diagnosticsCache.get(key);
  const fresh =
    cached && cached.generation === diagnosticsGeneration && Date.now() - cached.at < DIAGNOSTICS_TTL_MS;
  if (fresh) {
    sendJson(res, 200, cached.payload);
    return;
  }
  let inFlight = diagnosticsInFlight.get(key);
  if (!inFlight) {
    inFlight = computeDiagnostics(options);
    diagnosticsInFlight.set(key, inFlight);
    void inFlight.finally(() => {
      // Only clear our own slot; a mutation may have already replaced it.
      if (diagnosticsInFlight.get(key) === inFlight) diagnosticsInFlight.delete(key);
    });
  }
  let entry: DiagnosticsCacheEntry;
  try {
    entry = await inFlight;
  } catch {
    sendJson(res, 502, { error: "diagnostics_failed" });
    return;
  }
  // Cache only results that still reflect the current generation; a report computed across a
  // mutation is served once but never cached, so the next read recomputes against fresh state.
  if (entry.generation === diagnosticsGeneration) diagnosticsCache.set(key, entry);
  sendJson(res, 200, entry.payload);
}

async function forwardProxy(
  req: IncomingMessage,
  res: ServerResponse,
  target: string,
  token: string,
): Promise<void> {
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
    // Surface keyset pagination to the browser. The control plane advertises the next
    // page through a same-origin Link header; without forwarding it the web client
    // silently truncates large lists at the server default page size.
    const link = upstream.headers.get("link");
    if (link) res.setHeader("Link", link);
    res.end(text);
  } catch {
    sendJson(res, 502, { error: "upstream_unreachable" });
  } finally {
    clearTimeout(timer);
  }
}

async function handleProxy(req: IncomingMessage, res: ServerResponse, rest: string): Promise<void> {
  const token = adminToken();
  if (!token) {
    sendJson(res, 503, { error: "control_plane_not_configured" });
    return;
  }
  await forwardProxy(req, res, `${apiUrl()}${rest}`, token);
  // A successful write to the control plane can change what diagnostics reports (zone
  // inventory, resources, policy enforcement, …); drop cached reports so the next read
  // recomputes against the new state instead of surfacing a stale warning.
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && res.statusCode < 400) {
    invalidateDiagnostics();
  }
}

// Proxies the agent and delegation runtime surfaces served by the Coordinator.
async function handleCoordProxy(
  req: IncomingMessage,
  res: ServerResponse,
  rest: string,
): Promise<void> {
  const token = coordinatorToken();
  if (!token) {
    sendJson(res, 503, { error: "coordinator_not_configured" });
    return;
  }
  await forwardProxy(req, res, `${coordinatorUrl()}${rest}`, token);
}

// Returns true when the request was a console route and has been handled.
export async function handleConsole(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? "";
  if (!url.startsWith(API_PREFIX)) return false;

  const session = await validateSession(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthenticated" });
    return true;
  }

  if (url.startsWith(`${COORD_PREFIX}/`)) {
    await handleCoordProxy(req, res, url.slice(COORD_PREFIX.length));
    return true;
  }

  const path = url.slice(API_PREFIX.length);
  if (path === "/status" || path.startsWith("/status?")) {
    await handleStatus(res);
    return true;
  }
  if (path === "/diagnostics" || path.startsWith("/diagnostics?")) {
    await handleDiagnostics(res, path);
    return true;
  }
  if (path.startsWith("/v1/")) {
    await handleProxy(req, res, path);
    return true;
  }

  sendJson(res, 404, { error: "not_found" });
  return true;
}
