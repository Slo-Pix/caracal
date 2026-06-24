/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the navbar notifications bell: a dropdown of stored Console notifications.
*/
import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/cx";
import {
  clearNotifications,
  markAllRead,
  removeNotification,
  useNotifications,
  useUnreadCount,
  type NotificationTone,
} from "@/platform/state/notifications";

const TONE_DOT: Record<NotificationTone, string> = {
  success: "bg-emerald-500",
  error: "bg-destructive",
  info: "bg-muted-foreground",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function NotificationsMenu() {
  const notifications = useNotifications();
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (unread > 0) markAllRead();
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, unread]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={cx(
          "relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {notifications.length > 0 ? (
              <button
                onClick={clearNotifications}
                className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">You're all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Activity and alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="scrollbar-thin max-h-96 overflow-y-auto py-1">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="group flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  <span
                    className={cx("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", TONE_DOT[n.tone])}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    {n.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {relativeTime(n.ts)}
                    </p>
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    onClick={() => removeNotification(n.id)}
                    className="flex-shrink-0 text-muted-foreground/0 transition-colors hover:text-foreground group-hover:text-muted-foreground"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 6l12 12M6 18 18 6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
