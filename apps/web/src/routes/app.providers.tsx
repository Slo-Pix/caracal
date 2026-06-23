/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Providers route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ProviderFormModal } from "@/components/console/ProviderForm";
import {
  DetailField,
  DetailGroup,
  Mono,
  ResourceWorkspace,
} from "@/components/console/ResourceWorkspace";
import { ZoneScopedPage } from "@/components/console/ZoneScope";
import { Badge, Button, ConfirmDialog, useToast, type Column } from "@/components/ui";
import { cx } from "@/lib/cx";
import { ConsoleApiError } from "@/platform/api/client";
import {
  useCreateProvider,
  useDeleteProvider,
  useProviders,
  useUpdateProvider,
} from "@/platform/api/hooks";
import type { Provider, ProviderInput, ProviderKind } from "@/platform/api/types";

export const Route = createFileRoute("/app/providers")({
  component: ProvidersRoute,
});

const KIND_LABEL: Record<ProviderKind, string> = {
  none: "None",
  caracal_mandate: "Caracal mandate",
  oauth2_authorization_code: "OAuth 2.0 (auth code)",
  oauth2_client_credentials: "OAuth 2.0 (client creds)",
  api_key: "API key",
  bearer_token: "Bearer token",
};

const KIND_SHORT: Record<ProviderKind, string> = {
  none: "None",
  caracal_mandate: "Mandate",
  oauth2_authorization_code: "OAuth · auth code",
  oauth2_client_credentials: "OAuth · client creds",
  api_key: "API key",
  bearer_token: "Bearer",
};

function ProvidersRoute() {
  return (
    <ZoneScopedPage
      title="Providers"
      description="Credential sources that issue upstream access for this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Providers" }]}
    >
      {(zone) => <ProvidersPage zoneId={zone.id} zoneName={zone.name} />}
    </ZoneScopedPage>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ConsoleApiError) {
    if (error.notConfigured) return "Control plane not connected.";
    if (error.unreachable) return "Control plane unreachable.";
    return error.code.replace(/_/g, " ");
  }
  return "Unexpected error.";
}

function routingSummary(provider: Provider): string {
  const config = provider.config_json ?? {};
  const endpoint = config.token_endpoint ?? config.authorization_endpoint;
  if (typeof endpoint === "string") {
    try {
      return new URL(endpoint).host;
    } catch {
      return endpoint;
    }
  }
  if (typeof config.header_name === "string") return `header ${config.header_name}`;
  if (typeof config.query_param_name === "string") return `query ${config.query_param_name}`;
  if (Array.isArray(config.allowed_token_hosts) && config.allowed_token_hosts.length > 0) {
    return String(config.allowed_token_hosts[0]);
  }
  return "—";
}

function ProvidersPage({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const toast = useToast();
  const query = useProviders(zoneId);
  const createProvider = useCreateProvider(zoneId);
  const updateProvider = useUpdateProvider(zoneId);
  const deleteProvider = useDeleteProvider(zoneId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Provider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [kindFilter, setKindFilter] = useState<ProviderKind | "all">("all");

  const allRows = useMemo(() => query.data ?? [], [query.data]);

  const kindCounts = useMemo(() => {
    const counts = new Map<ProviderKind, number>();
    for (const provider of allRows) counts.set(provider.kind, (counts.get(provider.kind) ?? 0) + 1);
    return counts;
  }, [allRows]);

  const rows = useMemo(
    () => (kindFilter === "all" ? allRows : allRows.filter((p) => p.kind === kindFilter)),
    [allRows, kindFilter],
  );

  const columns: Column<Provider>[] = [
    {
      id: "name",
      header: "Provider",
      sortable: true,
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{p.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{p.identifier}</div>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Type",
      cell: (p) => <Badge tone="neutral">{KIND_SHORT[p.kind]}</Badge>,
    },
    {
      id: "routing",
      header: "Routing",
      cell: (p) => (
        <span className="truncate font-mono text-xs text-muted-foreground">
          {routingSummary(p)}
        </span>
      ),
    },
    {
      id: "secrets",
      header: "Credentials",
      cell: (p) =>
        p.secret_config_keys.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-600 dark:text-amber-400"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {p.secret_config_keys.length} sealed
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
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
    <>
      <ResourceWorkspace
        title="Providers"
        description="Credential sources that issue upstream access for this zone."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Providers" }]}
        primaryAction={{ label: "New provider", onClick: () => setCreateOpen(true) }}
        rows={rows}
        loading={query.isLoading}
        columns={columns}
        rowKey={(p) => p.id}
        headerExtra={
          allRows.length > 0 ? (
            <KindFilter
              counts={kindCounts}
              total={allRows.length}
              selected={kindFilter}
              onSelect={setKindFilter}
            />
          ) : undefined
        }
        search={{
          placeholder: "Search providers…",
          match: (p, q) =>
            p.name.toLowerCase().includes(q) ||
            p.identifier.toLowerCase().includes(q) ||
            KIND_LABEL[p.kind].toLowerCase().includes(q),
        }}
        sortOptions={[
          { id: "name", label: "Name" },
          { id: "recent", label: "Newest" },
        ]}
        empty={{
          title: query.isError ? "Could not load providers" : "No providers configured",
          description: query.isError
            ? errorMessage(query.error)
            : "Add a provider so applications can obtain mandates and upstream credentials.",
          actionLabel: query.isError ? undefined : "New provider",
          onAction: query.isError ? undefined : () => setCreateOpen(true),
        }}
        detail={{
          title: (p) => p.name,
          description: (p) => p.identifier,
          width: "max-w-xl",
          render: (p) => (
            <ProviderDetail
              provider={p}
              onEdit={() => setEditTarget(p)}
              onDelete={() => setDeleteTarget(p)}
            />
          ),
        }}
      />

      <ProviderFormModal
        open={createOpen}
        mode="create"
        busy={createProvider.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          try {
            const created = await createProvider.mutateAsync(input);
            setCreateOpen(false);
            toast({ tone: "success", title: "Provider created", description: created.name });
          } catch (err) {
            toast({ tone: "error", title: "Create failed", description: errorMessage(err) });
          }
        }}
      />

      <ProviderFormModal
        open={editTarget !== null}
        mode="edit"
        provider={editTarget ?? undefined}
        busy={updateProvider.isPending}
        onClose={() => setEditTarget(null)}
        onSubmit={async (input: ProviderInput) => {
          if (!editTarget) return;
          const kindUnchanged = input.kind === editTarget.kind;
          const patch = kindUnchanged
            ? { name: input.name, identifier: input.identifier, config_json: input.config_json }
            : input;
          try {
            await updateProvider.mutateAsync({ id: editTarget.id, input: patch });
            setEditTarget(null);
            toast({
              tone: "success",
              title: "Provider updated",
              description: input.name ?? editTarget.name,
            });
          } catch (err) {
            toast({ tone: "error", title: "Update failed", description: errorMessage(err) });
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete provider"
        description={`Deleting "${deleteTarget?.name ?? ""}" removes its credential routing. Resources bound to it will lose upstream access. This cannot be undone.`}
        confirmLabel="Delete provider"
        tone="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteProvider.mutateAsync(deleteTarget.id);
            toast({ tone: "info", title: "Provider deleted", description: deleteTarget.name });
          } catch (err) {
            toast({ tone: "error", title: "Delete failed", description: errorMessage(err) });
          }
        }}
      />
    </>
  );
}

function KindFilter({
  counts,
  total,
  selected,
  onSelect,
}: {
  counts: Map<ProviderKind, number>;
  total: number;
  selected: ProviderKind | "all";
  onSelect: (kind: ProviderKind | "all") => void;
}) {
  const present = (Object.keys(KIND_LABEL) as ProviderKind[]).filter((k) => counts.has(k));
  const chips: { id: ProviderKind | "all"; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    ...present.map((k) => ({ id: k, label: KIND_SHORT[k], count: counts.get(k) ?? 0 })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onSelect(chip.id)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            selected === chip.id
              ? "border-foreground/20 bg-accent text-foreground"
              : "border-border text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          {chip.label}
          <span className="font-mono text-[10px] text-muted-foreground">{chip.count}</span>
        </button>
      ))}
    </div>
  );
}

function ProviderDetail({
  provider,
  onEdit,
  onDelete,
}: {
  provider: Provider;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const secretKeys = new Set(provider.secret_config_keys);
  const configEntries = Object.entries(provider.config_json ?? {}).filter(
    ([key]) => !secretKeys.has(key as never),
  );
  const credentialKind = provider.kind !== "none" && provider.kind !== "caracal_mandate";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{KIND_LABEL[provider.kind]}</Badge>
        {provider.secret_config_keys.length > 0 ? (
          <Badge tone="warning">Secrets sealed</Badge>
        ) : credentialKind ? (
          <Badge tone="muted">No secret stored</Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>

      <DetailGroup title="Identity">
        <DetailField label="Name">{provider.name}</DetailField>
        <DetailField label="Identifier">
          <Mono>{provider.identifier}</Mono>
        </DetailField>
        <DetailField label="Type">{KIND_LABEL[provider.kind]}</DetailField>
        <DetailField label="Created">{new Date(provider.created_at).toLocaleString()}</DetailField>
        {provider.updated_at && provider.updated_at !== provider.created_at ? (
          <DetailField label="Updated">
            {new Date(provider.updated_at).toLocaleString()}
          </DetailField>
        ) : null}
      </DetailGroup>

      {credentialKind ? (
        <DetailGroup title="Credentials">
          {provider.secret_config_keys.length > 0 ? (
            <div className="flex flex-col gap-2 pt-2">
              {provider.secret_config_keys.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-foreground">{key}</span>
                  <span className="font-mono text-xs text-muted-foreground">•••••••• sealed</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pt-2 text-sm text-muted-foreground">
              No secret stored. Edit the provider to add one.
            </p>
          )}
        </DetailGroup>
      ) : null}

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Configuration
        </h3>
        {configEntries.length > 0 ? (
          <div className="mt-3 overflow-hidden border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {configEntries.map(([key, value]) => (
                  <tr key={key}>
                    <td className="w-2/5 px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                      {key}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">
                      {formatValue(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No configuration fields.</p>
        )}
      </section>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Connections
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          User and resource connections (provider grants) are established at runtime through the
          OAuth authorize flow and <Mono>caracal</Mono> CLI. They are not managed from the web
          console.
        </p>
      </section>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-destructive">
          Danger zone
        </h3>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Remove this provider and its credential routing.
          </p>
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
