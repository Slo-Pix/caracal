/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides a collapsible disclosure section used to keep advanced form options tidy.
*/
import { useId, useState, type ReactNode } from "react";

import { cx } from "@/lib/cx";

// A clean, self-contained collapsible block for advanced or optional form fields. It keeps
// the default form compact by tucking rarely-changed inputs behind a single, clearly labeled
// toggle, while still revealing itself automatically when it contains a validation error.
export function Disclosure({
  title,
  description,
  count,
  hasError,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  hasError?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = open || Boolean(hasError);
  const panelId = useId();

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cx(
            "flex-shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{title}</span>
            {typeof count === "number" && count > 0 ? (
              <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
            ) : null}
            {hasError ? (
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-destructive" />
            ) : null}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div id={panelId} className="flex flex-col gap-4 border-t border-border p-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
