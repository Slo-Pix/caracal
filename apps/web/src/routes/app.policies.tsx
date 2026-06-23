/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Policies route.
*/
import { createFileRoute } from "@tanstack/react-router";

import {
  DetailField,
  DetailGroup,
  Mono,
  ResourceWorkspace,
} from "@/components/console/ResourceWorkspace";
import { ZoneScopedPage } from "@/components/console/ZoneScope";
import { Badge, Skeleton, type Column } from "@/components/ui";
import { ConsoleApiError } from "@/platform/api/client";
import { usePolicies, usePolicy } from "@/platform/api/hooks";
import type { Policy } from "@/platform/api/types";

export const Route = createFileRoute("/app/policies")({
  component: PoliciesRoute,
});

function PoliciesRoute() {
  return (
    <ZoneScopedPage
      title="Policies"
      description="Versioned Rego authority rules. Versions are immutable once created."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Policies" }]}
    >
      {(zone) => <PoliciesPage zoneId={zone.id} />}
    </ZoneScopedPage>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ConsoleApiError) {
    if (error.notConfigured) return "Control plane not connected.";
    if (error.unreachable) return "Control plane unreachable.";
    return error.code;
  }
  return "Unexpected error.";
}

function PoliciesPage({ zoneId }: { zoneId: string }) {
  const query = usePolicies(zoneId);
  const rows = query.data ?? [];

  const columns: Column<Policy>[] = [
    {
      id: "name",
      header: "Policy",
      sortable: true,
      cell: (p) => (
        <div>
          <div className="font-medium text-foreground">{p.name}</div>
          {p.description ? (
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      cell: (p) => <Badge tone="neutral">{p.owner_type}</Badge>,
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      align: "right",
      cell: (p) => (
        <span className="text-xs text-muted-foreground">
          {new Date(p.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <ResourceWorkspace
      title="Policies"
      description="Versioned Rego authority rules. Versions are immutable once created."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Policies" }]}
      rows={rows}
      loading={query.isLoading}
      columns={columns}
      rowKey={(p) => p.id}
      search={{
        placeholder: "Search policies…",
        match: (p, q) =>
          p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q),
      }}
      sortOptions={[
        { id: "name", label: "Name" },
        { id: "recent", label: "Newest" },
      ]}
      empty={{
        title: query.isError ? "Could not load policies" : "No policies yet",
        description: query.isError
          ? errorMessage(query.error)
          : "Policies define the Rego rules that authorize requests. Create one to start governing this zone.",
      }}
      detail={{
        title: (p) => p.name,
        description: (p) => p.id,
        width: "max-w-lg",
        render: (p) => <PolicyDetail zoneId={zoneId} policy={p} />,
      }}
    />
  );
}

function PolicyDetail({ zoneId, policy }: { zoneId: string; policy: Policy }) {
  const detail = usePolicy(zoneId, policy.id);
  const versions = detail.data?.versions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <DetailGroup title="Metadata">
        <DetailField label="Name">{policy.name}</DetailField>
        <DetailField label="Description">{policy.description ?? "—"}</DetailField>
        <DetailField label="Owner">{policy.owner_type}</DetailField>
        <DetailField label="Created by">{policy.created_by}</DetailField>
        <DetailField label="Created">{new Date(policy.created_at).toLocaleString()}</DetailField>
      </DetailGroup>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Versions
        </h3>
        {detail.isLoading ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : detail.isError ? (
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage(detail.error)}</p>
        ) : versions.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {versions
                  .slice()
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2">
                        <Badge tone="neutral">v{v.version}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {v.content_sha256.slice(0, 12)}…
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No versions.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Versions are immutable. A new version is added rather than editing an existing one.
        </p>
      </section>
    </div>
  );
}
