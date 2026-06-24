/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the sidebar Contact us and Customize actions shown above the profile menu.
*/
import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/cx";
import { NAV_GROUPS } from "@/platform/nav/navModel";
import { useTheme } from "@/platform/theme";
import { PINNED_NAV_ITEMS, toggleNavItem, useHiddenNavItems } from "@/platform/state/sidebarPrefs";

const CAL_LINK = "rawx18/caracal-enterprise-sales";

type OpenPanel = "contact" | "customize" | null;

export function SidebarActions({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState<OpenPanel>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <div className={cx("flex gap-1.5", collapsed ? "flex-col items-center" : "flex-row")}>
        <ActionButton
          collapsed={collapsed}
          active={open === "contact"}
          label="Contact us"
          onClick={() => setOpen((v) => (v === "contact" ? null : "contact"))}
          icon={
            <>
              <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="m3.5 8 8.5 6 8.5-6" />
            </>
          }
        />
        <ActionButton
          collapsed={collapsed}
          active={open === "customize"}
          label="Customize"
          onClick={() => setOpen((v) => (v === "customize" ? null : "customize"))}
          icon={
            <>
              <path d="M4 6h16M4 12h16M4 18h16" />
              <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
              <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
              <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
            </>
          }
        />
      </div>

      {open === "contact" ? <ContactPanel /> : null}
      {open === "customize" ? <CustomizePanel /> : null}
    </div>
  );
}

function ActionButton({
  collapsed,
  active,
  label,
  onClick,
  icon,
}: {
  collapsed: boolean;
  active: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cx(
        "flex items-center justify-center rounded-md border border-border font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        collapsed ? "h-9 w-9" : "h-8 flex-1 gap-1.5 px-2 text-xs",
        active && "bg-accent text-foreground",
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        {icon}
      </svg>
      {!collapsed ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  );
}

function ContactPanel() {
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const cal = await getCalApi();
      cal("ui", { theme, hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, [theme]);

  return (
    <div className="absolute bottom-full left-0 z-40 mb-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">Talk to sales</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Book an Enterprise call — SSO, multi-tenancy, and managed services.
        </p>
      </div>
      <div className="scrollbar-thin max-h-[24rem] overflow-y-auto">
        <Cal
          calLink={CAL_LINK}
          style={{ width: "100%", height: "380px", overflow: "scroll" }}
          config={{ layout: "month_view", theme }}
        />
      </div>
    </div>
  );
}

function CustomizePanel() {
  const hidden = useHiddenNavItems();
  const hiddenSet = new Set(hidden);

  return (
    <div className="absolute bottom-full left-0 z-40 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">Customize sidebar</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Choose which pages appear.</p>
      </div>
      <div className="scrollbar-thin max-h-80 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-2 last:mb-0">
            <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((item) => {
              const pinned = PINNED_NAV_ITEMS.has(item.id);
              const visible = pinned || !hiddenSet.has(item.id);
              return (
                <label
                  key={item.id}
                  className={cx(
                    "flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm",
                    pinned ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent",
                  )}
                >
                  <span className="truncate text-foreground">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={visible}
                    disabled={pinned}
                    onChange={() => toggleNavItem(item.id)}
                    className="h-4 w-4 flex-shrink-0 accent-foreground"
                  />
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
