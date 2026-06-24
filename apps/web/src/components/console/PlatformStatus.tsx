/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the always-visible navbar platform health indicator that links to Diagnostics.
*/
import { useNavigate } from "@tanstack/react-router";

import { cx } from "@/lib/cx";
import { platformHealthOf, useDiagnostics, type PlatformHealth } from "@/platform/api/hooks";

const TONE: Record<PlatformHealth, { dot: string; ring: string; label: string }> = {
  healthy: {
    dot: "bg-emerald-500",
    ring: "bg-emerald-500/70",
    label: "All systems healthy",
  },
  attention: {
    dot: "bg-amber-500",
    ring: "bg-amber-500/70",
    label: "Degraded",
  },
  unhealthy: {
    dot: "bg-destructive",
    ring: "bg-destructive/70",
    label: "Failures",
  },
  unknown: {
    dot: "bg-muted-foreground",
    ring: "bg-muted-foreground/40",
    label: "Checking…",
  },
};

export function PlatformStatus() {
  const navigate = useNavigate();
  const diagnostics = useDiagnostics();
  const health = diagnostics.isError ? "unhealthy" : platformHealthOf(diagnostics.data);
  const tone = TONE[health];

  const summary = diagnostics.data?.summary;
  const detail = diagnostics.isError
    ? "Diagnostics unavailable"
    : summary
      ? health === "healthy"
        ? `${summary.total} checks passing`
        : `${summary.fail} failing · ${summary.warn} warnings`
      : tone.label;

  return (
    <button
      onClick={() => navigate({ to: "/app/diagnostics" })}
      aria-label={`Platform status: ${tone.label}. Open Diagnostics.`}
      title={`${tone.label} — open Diagnostics`}
      className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {health !== "unknown" ? (
          <span
            className={cx(
              "absolute inline-flex h-full w-full rounded-full",
              tone.ring,
              health === "healthy" ? "animate-ping" : "animate-pulse",
            )}
          />
        ) : null}
        <span className={cx("relative inline-flex h-2 w-2 rounded-full", tone.dot)} />
      </span>
      <span className="hidden whitespace-nowrap lg:inline">{detail}</span>
    </button>
  );
}
