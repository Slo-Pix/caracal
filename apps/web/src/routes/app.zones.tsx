/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the zones management route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Pagination,
  SearchInput,
  Skeleton,
  Tooltip,
  useToast,
  type Column,
  type SortState,
} from "@/components/ui";
import { ConsoleApiError } from "@/platform/api/client";
import {
  useConsoleStatus,
  useCreateZone,
  useDeleteZone,
  useZones,
  selectZone,
} from "@/platform/api/hooks";
import { getActiveZoneId } from "@/platform/state/localInstall";
import type { Zone } from "@/platform/api/types";

const PAGE_SIZE = 8;

export const Route = createFileRoute("/app/zones")({
  component: ZonesPage,
});

function errorMessage(error: unknown): string {
  if (error instanceof ConsoleApiError) {
    if (error.notConfigured) return "Control plane not connected.";
    if (error.unreachable) return "Control plane unreachable.";
    return error.code;
  }
  return "Unexpected error.";
}

function ZonesPage() {
  const toast = useToast();
  const status = useConsoleStatus();
  const zonesQuery = useZones();
  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ column: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const activeId = getActiveZoneId();

  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [query, sort]);

  const visible = useMemo(() => {
    const filtered = zones.filter((zone) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return zone.name.toLowerCase().includes(q) || zone.slug.toLowerCase().includes(q);
    });
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.column === "slug") return a.slug.localeCompare(b.slug) * dir;
      if (sort.column === "created")
        return (Date.parse(a.created_at) - Date.parse(b.created_at)) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [zones, query, sort]);

  const paged = useMemo(
    () => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visible, page],
  );

  function toggleSort(column: string) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  const columns: Column<Zone>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (zone) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{zone.name}</span>
          {zone.id === activeId ? <Badge tone="success">Active</Badge> : null}
        </div>
      ),
    },
    {
      id: "slug",
      header: "Slug",
      sortable: true,
      cell: (zone) => <span className="font-mono text-xs text-muted-foreground">{zone.slug}</span>,
    },
    {
      id: "dcr",
      header: "DCR",
      cell: (zone) =>
        zone.dcr_enabled ? <Badge tone="neutral">Enabled</Badge> : <Badge tone="muted">Off</Badge>,
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      cell: (zone) => (
        <span className="text-xs text-muted-foreground">
          {new Date(zone.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      width: "1%",
      cell: (zone) => (
        <div className="flex justify-end gap-1">
          <Tooltip label="Make this the active zone">
            <Button
              variant="ghost"
              size="sm"
              disabled={zone.id === activeId}
              onClick={() => {
                selectZone(zone.id);
                toast({ tone: "success", title: "Active zone switched", description: zone.name });
              }}
            >
              Switch
            </Button>
          </Tooltip>
          <Tooltip label="Delete this zone">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(zone)}>
              Delete
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  if (status.isLoading) {
    return (
      <ModulePage
        title="Zones"
        description="Zones are Caracal's primary trust boundary."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Zones" }]}
      >
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </ModulePage>
    );
  }

  const disconnected = status.isError || !status.data?.configured || !status.data?.reachable;
  if (disconnected) {
    const title = !status.data?.configured
      ? "Control plane not connected"
      : "Control plane unreachable";
    const description = !status.data?.configured
      ? "No admin credentials were found. Start the local stack with `caracal up` to provision the control plane, then reload."
      : `The control plane at ${status.data?.apiUrl ?? ""} is not responding. Confirm it is running, then retry.`;
    return (
      <ModulePage
        title="Zones"
        description="Zones are Caracal's primary trust boundary."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Zones" }]}
      >
        <EmptyState
          title={title}
          description={description}
          action={<Button onClick={() => status.refetch()}>Retry</Button>}
        />
      </ModulePage>
    );
  }

  return (
    <ModulePage
      title="Zones"
      description="Zones are Caracal's primary trust boundary. Create, switch, and remove them here."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Zones" }]}
      actions={<Button onClick={() => setCreateOpen(true)}>New zone</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search zones…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <DataTable
        columns={columns}
        rows={paged}
        rowKey={(zone) => zone.id}
        loading={zonesQuery.isLoading}
        sort={sort}
        onSortChange={toggleSort}
        empty={
          <EmptyState
            title={
              zonesQuery.isError
                ? "Could not load zones"
                : query
                  ? "No matching zones"
                  : "No zones yet"
            }
            description={
              zonesQuery.isError
                ? errorMessage(zonesQuery.error)
                : query
                  ? "Try a different search term."
                  : "Create your first zone to start managing applications, resources, and policies."
            }
            action={
              !query && !zonesQuery.isError ? (
                <Button onClick={() => setCreateOpen(true)}>Create zone</Button>
              ) : undefined
            }
          />
        }
      />

      {!zonesQuery.isLoading && visible.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={visible.length}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      <CreateZoneModal
        open={createOpen}
        busy={createZone.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (name) => {
          try {
            const zone = await createZone.mutateAsync({ name });
            setCreateOpen(false);
            toast({ tone: "success", title: "Zone created", description: zone.name });
          } catch (err) {
            toast({ tone: "error", title: "Create failed", description: errorMessage(err) });
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete zone"
        description={`Deleting "${deleteTarget?.name ?? ""}" permanently removes its applications, resources, policies, and audit. This cannot be undone.`}
        confirmLabel="Delete zone"
        tone="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteZone.mutateAsync(deleteTarget.id);
            toast({ tone: "info", title: "Zone deleted", description: deleteTarget.name });
          } catch (err) {
            toast({ tone: "error", title: "Delete failed", description: errorMessage(err) });
          }
        }}
      />
    </ModulePage>
  );
}

function CreateZoneModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create zone"
      description="A zone isolates applications, resources, policies, and audit."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && onSubmit(name.trim())}
            loading={busy}
            disabled={!name.trim()}
          >
            Create zone
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Zone name"
          placeholder="Production"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
  );
}
