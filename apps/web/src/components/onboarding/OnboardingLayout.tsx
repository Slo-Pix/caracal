/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file frames the guided onboarding flow with a progress indicator.
*/
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export function OnboardingProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((label, index) => {
        const state = index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cx(
                "grid h-6 w-6 place-items-center rounded-full border text-xs font-semibold",
                state === "done" && "border-transparent bg-primary text-primary-foreground",
                state === "active" && "border-foreground text-foreground",
                state === "todo" && "border-border text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cx(
                "text-sm",
                state === "todo" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {label}
            </span>
            {index < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingLayout({
  steps,
  current,
  children,
}: {
  steps: string[];
  current: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Set up your installation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few steps to a working Caracal control plane.
          </p>
        </div>
        <div className="mb-8">
          <OnboardingProgress steps={steps} current={current} />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">{children}</div>
      </div>
    </div>
  );
}
