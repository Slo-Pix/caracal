/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Diagnostics route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/console/ModulePage";
import { Badge, Button, Card, SectionTitle, Skeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
import { useActiveZone, useConsoleStatus, useZones } from "@/platform/api/hooks";

export const Route = createFileRoute("/app/diagnostics")({
  component: DiagnosticsPage,
});

type Level = "ok" | "warn" | "down";

function DiagnosticsPage() {
  const status = useConsoleStatus();
  const zones = useZones();
  const { activeZone } = useActiveZone();

  const loading = status.isLoading;
  const configured = status.data?.configured ?? false;
  const reachable = status.data?.reachable ?? false;

  const checks: { id: string; label: string; level: Level; detail: string }[] = [];
  if (!loading) {
    checks.push({
      id: "credentials",
      label: "Admin credentials",
      level: configured ? "ok" : "down",
      detail: configured
        ? "Control plane credentials are configured."
        : "No admin credentials found. Run `caracal up` to provision them.",
    });
    checks.push({
      id: "reachable",
      label: "Control plane reachability",
      level: reachable ? "ok" : configured ? "down" : "warn",
      detail: reachable
        ? `Reachable at ${status.data?.apiUrl ?? ""}.`
        : configured
          ? `No response from ${status.data?.apiUrl ?? "the control plane"}.`
          : "Skipped — credentials not configured.",
    });
    checks.push({
      id: "zones",
      label: "Zones",
      level: zones.isError ? "down" : (zones.data?.length ?? 0) > 0 ? "ok" : "warn",
      detail: zones.isError
        ? "Could not list zones."
        : (zones.data?.length ?? 0) > 0
          ? `${zones.data?.length} zone(s) available.`
          : "No zones yet. Create one to begin.",
    });
    checks.push({
      id: "active-zone",
      label: "Active zone",
      level: activeZone ? "ok" : "warn",
      detail: activeZone ? `${activeZone.name} (${activeZone.slug}).` : "No active zone selected.",
    });
  }

  return (
    <ModulePage
      title="Diagnostics"
      description="Readiness and configuration checks for the control plane."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Diagnostics" }]}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            status.refetch();
            zones.refetch();
          }}
          loading={status.isFetching}
        >
          Re-run checks
        </Button>
      }
    >
      <Card>
        <SectionTitle>Control plane</SectionTitle>
        {loading ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-3 py-3">
                <Dot level={check.level} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{check.label}</span>
                    <LevelBadge level={check.level} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <SectionTitle>Endpoint</SectionTitle>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-foreground">Admin API</span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {status.data?.apiUrl ?? "—"}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The web client reaches the control plane through the session-guarded console backend.
          Admin credentials never leave the server.
        </p>
      </Card>
    </ModulePage>
  );
}

function Dot({ level }: { level: Level }) {
  const tone = { ok: "bg-emerald-500", warn: "bg-amber-500", down: "bg-destructive" }[level];
  return <span className={cx("mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full", tone)} />;
}

function LevelBadge({ level }: { level: Level }) {
  if (level === "ok") return <Badge tone="success">OK</Badge>;
  if (level === "warn") return <Badge tone="warning">Attention</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}
