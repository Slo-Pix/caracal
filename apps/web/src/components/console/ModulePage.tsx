/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the standard header frame for Console module pages.
*/
import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/ui";

export function ModulePage({
  title,
  description,
  actions,
  breadcrumbs,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  children: ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="mb-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
