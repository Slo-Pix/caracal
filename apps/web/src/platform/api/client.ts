/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file is the typed HTTP client the web app uses to reach the Caracal control plane through the session-guarded console backend.
*/
import { config } from "@/platform/config";

import type {
  Application,
  ApplicationInput,
  ApplicationPatchInput,
  AuditDetail,
  AuditEvent,
  ConsoleStatus,
  DecisionTrace,
  ActivationStatus,
  Policy,
  PolicyDetail,
  PolicyInput,
  PolicyManifestEntry,
  PolicySet,
  PolicySetDetail,
  PolicySetVersion,
  PolicyValidateResult,
  Provider,
  ProviderInput,
  ProviderPatchInput,
  Resource,
  ResourceInput,
  ResourcePatchInput,
  RowList,
  Session,
  SimulateResult,
  Zone,
  ZoneInput,
  ZonePatchInput,
  ZoneDcrStatus,
} from "./types";

export class ConsoleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: unknown,
  ) {
    super(code);
    this.name = "ConsoleApiError";
  }

  get notConfigured(): boolean {
    return this.code === "control_plane_not_configured";
  }

  get unreachable(): boolean {
    return this.code === "control_plane_unreachable";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.consoleBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers:
        init?.body !== undefined
          ? { "Content-Type": "application/json", ...init?.headers }
          : init?.headers,
    });
  } catch {
    throw new ConsoleApiError(0, "network_error");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const code =
      parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : res.statusText || "request_failed";
    throw new ConsoleApiError(res.status, code, parsed);
  }

  return parsed as T;
}

export const consoleApi = {
  status: () => request<ConsoleStatus>("/status"),

  zones: {
    list: () => request<Zone[]>("/v1/zones"),
    get: (id: string) => request<Zone>(`/v1/zones/${encodeURIComponent(id)}`),
    dcrStatus: (id: string) =>
      request<ZoneDcrStatus>(`/v1/zones/${encodeURIComponent(id)}/dcr-status`),
    create: (input: ZoneInput) =>
      request<Zone>("/v1/zones", { method: "POST", body: JSON.stringify(input) }),
    patch: (id: string, input: ZonePatchInput) =>
      request<Zone>(`/v1/zones/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<void>(`/v1/zones/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  applications: {
    list: (zoneId: string) =>
      request<Application[]>(`/v1/zones/${encodeURIComponent(zoneId)}/applications`),
    create: (zoneId: string, input: ApplicationInput) =>
      request<Application>(`/v1/zones/${encodeURIComponent(zoneId)}/applications`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (zoneId: string, id: string, input: ApplicationPatchInput) =>
      request<{ id: string; name: string }>(
        `/v1/zones/${encodeURIComponent(zoneId)}/applications/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    delete: (zoneId: string, id: string) =>
      request<void>(
        `/v1/zones/${encodeURIComponent(zoneId)}/applications/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
  },

  resources: {
    list: (zoneId: string) =>
      request<Resource[]>(`/v1/zones/${encodeURIComponent(zoneId)}/resources`),
    get: (zoneId: string, id: string) =>
      request<Resource>(
        `/v1/zones/${encodeURIComponent(zoneId)}/resources/${encodeURIComponent(id)}`,
      ),
    create: (zoneId: string, input: ResourceInput) =>
      request<Resource>(`/v1/zones/${encodeURIComponent(zoneId)}/resources`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (zoneId: string, id: string, input: ResourcePatchInput) =>
      request<Resource>(
        `/v1/zones/${encodeURIComponent(zoneId)}/resources/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    delete: (zoneId: string, id: string) =>
      request<void>(`/v1/zones/${encodeURIComponent(zoneId)}/resources/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  providers: {
    list: (zoneId: string) =>
      request<Provider[]>(`/v1/zones/${encodeURIComponent(zoneId)}/providers`),
    get: (zoneId: string, id: string) =>
      request<Provider>(
        `/v1/zones/${encodeURIComponent(zoneId)}/providers/${encodeURIComponent(id)}`,
      ),
    create: (zoneId: string, input: ProviderInput) =>
      request<Provider>(`/v1/zones/${encodeURIComponent(zoneId)}/providers`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (zoneId: string, id: string, input: ProviderPatchInput) =>
      request<Provider>(
        `/v1/zones/${encodeURIComponent(zoneId)}/providers/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    delete: (zoneId: string, id: string) =>
      request<void>(`/v1/zones/${encodeURIComponent(zoneId)}/providers/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  policies: {
    list: (zoneId: string) => request<Policy[]>(`/v1/zones/${encodeURIComponent(zoneId)}/policies`),
    get: (zoneId: string, id: string) =>
      request<PolicyDetail>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policies/${encodeURIComponent(id)}`,
      ),
    validate: (content: string) =>
      request<PolicyValidateResult>(`/v1/policies/validate`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    create: (zoneId: string, input: PolicyInput) =>
      request<{ id: string }>(`/v1/zones/${encodeURIComponent(zoneId)}/policies`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    addVersion: (zoneId: string, id: string, content: string) =>
      request<{ version_id: string; version: number }>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policies/${encodeURIComponent(id)}/versions`,
        { method: "POST", body: JSON.stringify({ content }) },
      ),
    delete: (zoneId: string, id: string) =>
      request<void>(`/v1/zones/${encodeURIComponent(zoneId)}/policies/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  policySets: {
    list: (zoneId: string) =>
      request<PolicySet[]>(`/v1/zones/${encodeURIComponent(zoneId)}/policy-sets`),
    get: (zoneId: string, id: string) =>
      request<PolicySetDetail>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}`,
      ),
    create: (zoneId: string, name: string, description?: string) =>
      request<PolicySet>(`/v1/zones/${encodeURIComponent(zoneId)}/policy-sets`, {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    addVersion: (zoneId: string, id: string, manifest: PolicyManifestEntry[]) =>
      request<{ version_id: string; version: number }>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}/versions`,
        { method: "POST", body: JSON.stringify({ manifest }) },
      ),
    getVersion: (zoneId: string, id: string, versionId: string) =>
      request<PolicySetVersion>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`,
      ),
    activate: (zoneId: string, id: string, versionId: string, shadowVersionId?: string) =>
      request<{ activated: boolean; version_id: string; status_url: string }>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}/activate`,
        {
          method: "POST",
          body: JSON.stringify({
            version_id: versionId,
            ...(shadowVersionId ? { shadow_version_id: shadowVersionId } : {}),
          }),
        },
      ),
    activationStatus: (zoneId: string, id: string, versionId?: string) =>
      request<ActivationStatus>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}/activation-status${versionId ? `?version_id=${encodeURIComponent(versionId)}` : ""}`,
      ),
    simulate: (zoneId: string, id: string, versionId: string, input?: Record<string, unknown>) =>
      request<SimulateResult>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}/simulate`,
        {
          method: "POST",
          body: JSON.stringify({ version_id: versionId, ...(input ? { input } : {}) }),
        },
      ),
    delete: (zoneId: string, id: string) =>
      request<void>(
        `/v1/zones/${encodeURIComponent(zoneId)}/policy-sets/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
  },

  sessions: {
    list: async (zoneId: string, limit = 100) => {
      const res = await request<RowList<Session>>(
        `/v1/zones/${encodeURIComponent(zoneId)}/sessions?limit=${limit}`,
      );
      return res.rows;
    },
  },

  audit: {
    list: async (zoneId: string, limit = 100) => {
      const res = await request<RowList<AuditEvent>>(
        `/v1/zones/${encodeURIComponent(zoneId)}/audit?limit=${limit}`,
      );
      return res.rows;
    },
    byRequest: (zoneId: string, requestId: string) =>
      request<AuditDetail[]>(
        `/v1/zones/${encodeURIComponent(zoneId)}/audit/by-request/${encodeURIComponent(requestId)}`,
      ),
    explain: (zoneId: string, requestId: string) =>
      request<DecisionTrace>(
        `/v1/zones/${encodeURIComponent(zoneId)}/audit/by-request/${encodeURIComponent(requestId)}/explain`,
      ),
  },
};
