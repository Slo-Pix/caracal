/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file exposes React Query hooks and active-zone state for the control-plane console screens.
*/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { getActiveZoneId, setActiveZoneId } from "@/platform/state/localInstall";

import { consoleApi } from "./client";
import type { ApplicationInput, Zone, ZoneInput } from "./types";

const STALE_MS = 15_000;

export function useConsoleStatus() {
  return useQuery({
    queryKey: ["console", "status"],
    queryFn: () => consoleApi.status(),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useZones() {
  return useQuery({
    queryKey: ["console", "zones"],
    queryFn: () => consoleApi.zones.list(),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ZoneInput) => consoleApi.zones.create(input),
    onSuccess: (zone) => {
      qc.invalidateQueries({ queryKey: ["console", "zones"] });
      if (!getActiveZoneId()) selectZone(zone.id);
    },
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => consoleApi.zones.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["console", "zones"] }),
  });
}

export function useApplications(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "applications", zoneId],
    queryFn: () => consoleApi.applications.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function useCreateApplication(zoneId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      consoleApi.applications.create(zoneId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["console", "applications", zoneId] }),
  });
}

export function useDeleteApplication(zoneId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => consoleApi.applications.delete(zoneId as string, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["console", "applications", zoneId] }),
  });
}

export function useResources(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "resources", zoneId],
    queryFn: () => consoleApi.resources.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function useProviders(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "providers", zoneId],
    queryFn: () => consoleApi.providers.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function usePolicies(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "policies", zoneId],
    queryFn: () => consoleApi.policies.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function usePolicySets(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "policy-sets", zoneId],
    queryFn: () => consoleApi.policySets.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function usePolicy(zoneId: string | null, id: string | null) {
  return useQuery({
    queryKey: ["console", "policy", zoneId, id],
    queryFn: () => consoleApi.policies.get(zoneId as string, id as string),
    enabled: Boolean(zoneId && id),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function useSessions(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "sessions", zoneId],
    queryFn: () => consoleApi.sessions.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function useAudit(zoneId: string | null) {
  return useQuery({
    queryKey: ["console", "audit", zoneId],
    queryFn: () => consoleApi.audit.list(zoneId as string),
    enabled: Boolean(zoneId),
    staleTime: STALE_MS,
    retry: false,
  });
}

export function useDecisionTrace(zoneId: string | null, requestId: string | null) {
  return useQuery({
    queryKey: ["console", "audit-explain", zoneId, requestId],
    queryFn: () => consoleApi.audit.explain(zoneId as string, requestId as string),
    enabled: Boolean(zoneId && requestId),
    staleTime: STALE_MS,
    retry: false,
  });
}

const zoneListeners = new Set<() => void>();

function emitZoneChange(): void {
  for (const listener of zoneListeners) listener();
}

export function selectZone(id: string): void {
  setActiveZoneId(id);
  emitZoneChange();
}

function subscribeZone(listener: () => void): () => void {
  zoneListeners.add(listener);
  return () => zoneListeners.delete(listener);
}

// Resolves the persisted active zone against the live zone list, falling back to
// the first available zone so screens always have a coherent zone context.
export function useActiveZone(): {
  zones: Zone[];
  activeZone: Zone | null;
  selectZone: (id: string) => void;
} {
  const zonesQuery = useZones();
  const persistedId = useSyncExternalStore(subscribeZone, getActiveZoneId, () => null);
  const zones = zonesQuery.data ?? [];
  const activeZone = zones.find((zone) => zone.id === persistedId) ?? zones[0] ?? null;
  return { zones, activeZone, selectZone };
}
