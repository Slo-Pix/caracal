/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the always-visible zone switcher.
*/
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { cx } from "@/lib/cx";
import type { ZoneRecord } from "@/platform/state/localInstall";

export function ZoneSwitcher({
  zones,
  activeZoneId,
  onSelect,
}: {
  zones: ZoneRecord[];
  activeZoneId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = zones.find((zone) => zone.id === activeZoneId) ?? zones[0] ?? null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
      >
        <span className="grid h-5 w-5 place-items-center rounded bg-foreground text-[10px] font-bold text-background">
          Z
        </span>
        <span className="font-medium text-foreground">{active ? active.name : "No zone"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-popover p-1 shadow-lg">
            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Switch zone
            </div>
            {zones.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted-foreground">No active zones.</div>
            ) : (
              zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => {
                    onSelect(zone.id);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                    zone.id === active?.id && "bg-accent",
                  )}
                >
                  <span className="text-foreground">{zone.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{zone.slug}</span>
                </button>
              ))
            )}
            <div className="my-1 h-px bg-border" />
            <Link
              to="/app/zones"
              onClick={() => setOpen(false)}
              className="block rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              Manage zones
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
