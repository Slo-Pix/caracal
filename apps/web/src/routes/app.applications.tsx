/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Applications route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DetailField,
  DetailGroup,
  Mono,
  ResourceWorkspace,
} from "@/components/console/ResourceWorkspace";
import { ZoneScopedPage } from "@/components/console/ZoneScope";
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Modal,
  Textarea,
  useToast,
  type Column,
} from "@/components/ui";
import { ConsoleApiError } from "@/platform/api/client";
import { useApplications, useCreateApplication, useDeleteApplication } from "@/platform/api/hooks";
import type { Application } from "@/platform/api/types";

export const Route = createFileRoute("/app/applications")({
  component: ApplicationsRoute,
});

function ApplicationsRoute() {
  return (
    <ZoneScopedPage
      title="Applications"
      description="Agent identities that can request authority in this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Applications" }]}
    >
      {(zone) => <ApplicationsPage zoneId={zone.id} zoneName={zone.name} />}
    </ZoneScopedPage>
  );
}

function isExpired(app: Application): boolean {
  return Boolean(app.expires_at && Date.parse(app.expires_at) < Date.now());
}

function errorMessage(error: unknown): string {
  if (error instanceof ConsoleApiError) {
    if (error.notConfigured) return "Control plane not connected.";
    if (error.unreachable) return "Control plane unreachable.";
    return error.code;
  }
  return "Unexpected error.";
}

function ApplicationsPage({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const toast = useToast();
  const query = useApplications(zoneId);
  const createApp = useCreateApplication(zoneId);
  const deleteApp = useDeleteApplication(zoneId);

  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<{ name: string; clientSecret: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const rows = query.data ?? [];

  const columns: Column<Application>[] = [
    {
      id: "name",
      header: "Application",
      sortable: true,
      cell: (app) => (
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {app.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="font-medium text-foreground">{app.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{app.id}</div>
          </div>
        </div>
      ),
    },
    {
      id: "registration",
      header: "Registration",
      cell: (app) => (
        <Badge tone="neutral">
          {app.registration_method === "dcr" ? "Dynamic (DCR)" : "Managed"}
        </Badge>
      ),
    },
    {
      id: "traits",
      header: "Traits",
      cell: (app) => (
        <span className="text-sm text-muted-foreground">{app.traits?.length ?? 0}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (app) =>
        isExpired(app) ? <Badge tone="muted">Expired</Badge> : <Badge tone="success">Active</Badge>,
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      align: "right",
      cell: (app) => (
        <span className="text-xs text-muted-foreground">
          {new Date(app.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <ResourceWorkspace
        title="Applications"
        description="Agent identities that can request authority in this zone."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Applications" }]}
        primaryAction={{ label: "New application", onClick: () => setCreateOpen(true) }}
        rows={rows}
        loading={query.isLoading}
        columns={columns}
        rowKey={(app) => app.id}
        search={{
          placeholder: "Search applications…",
          match: (app, q) => app.name.toLowerCase().includes(q) || app.id.toLowerCase().includes(q),
        }}
        sortOptions={[
          { id: "recent", label: "Recently created" },
          { id: "name", label: "Name" },
        ]}
        empty={{
          title: query.isError ? "Could not load applications" : "No applications yet",
          description: query.isError
            ? errorMessage(query.error)
            : "Create an application to give an agent a scoped identity in this zone.",
          actionLabel: query.isError ? undefined : "New application",
          onAction: query.isError ? undefined : () => setCreateOpen(true),
        }}
        detail={{
          title: (app) => app.name,
          description: (app) => app.id,
          render: (app) => <ApplicationDetail app={app} onDelete={() => setDeleteTarget(app)} />,
        }}
      />

      <CreateApplicationModal
        open={createOpen}
        zoneName={zoneName}
        busy={createApp.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (name, traits) => {
          try {
            const app = await createApp.mutateAsync({
              name,
              registration_method: "managed",
              traits,
            });
            setCreateOpen(false);
            if (app.client_secret) {
              setSecret({ name: app.name, clientSecret: app.client_secret });
            } else {
              toast({ tone: "success", title: "Application created", description: app.name });
            }
          } catch (err) {
            toast({ tone: "error", title: "Create failed", description: errorMessage(err) });
          }
        }}
      />

      <SecretModal
        secret={secret}
        onClose={() => setSecret(null)}
        onCopied={() => toast({ tone: "success", title: "Client secret copied" })}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete application"
        description={`Deleting "${deleteTarget?.name ?? ""}" permanently revokes its identity. This cannot be undone.`}
        confirmLabel="Delete application"
        tone="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteApp.mutateAsync(deleteTarget.id);
            toast({ tone: "info", title: "Application deleted", description: deleteTarget.name });
          } catch (err) {
            toast({ tone: "error", title: "Delete failed", description: errorMessage(err) });
          }
        }}
      />
    </>
  );
}

function ApplicationDetail({ app, onDelete }: { app: Application; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {isExpired(app) ? (
          <Badge tone="muted">Expired</Badge>
        ) : (
          <Badge tone="success">Active</Badge>
        )}
        <Badge tone="neutral">
          {app.registration_method === "dcr" ? "Dynamic (DCR)" : "Managed"}
        </Badge>
      </div>

      <DetailGroup title="Identity">
        <DetailField label="Name">{app.name}</DetailField>
        <DetailField label="Application ID">
          <Mono>{app.id}</Mono>
        </DetailField>
        <DetailField label="Created">{new Date(app.created_at).toLocaleString()}</DetailField>
        {app.expires_at ? (
          <DetailField label="Expires">{new Date(app.expires_at).toLocaleString()}</DetailField>
        ) : null}
      </DetailGroup>

      <DetailGroup title="Traits">
        {app.traits && app.traits.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {app.traits.map((trait) => (
              <Badge key={trait} tone="neutral">
                <Mono>{trait}</Mono>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="pt-2 text-sm text-muted-foreground">No traits assigned.</p>
        )}
      </DetailGroup>

      {app.registration_method === "dcr" ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Dynamic clients are created programmatically and expire automatically. They are read-only
          here.
        </p>
      ) : (
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete application
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateApplicationModal({
  open,
  zoneName,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  zoneName: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string, traits: string[] | undefined) => void;
}) {
  const [name, setName] = useState("");
  const [traits, setTraits] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setTraits("");
    }
  }, [open]);

  function submit() {
    if (!name.trim()) return;
    const parsed = traits
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit(name.trim(), parsed.length > 0 ? parsed : undefined);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New application"
      description={`Give an agent a managed identity in ${zoneName}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            Create application
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Name"
          placeholder="billing-worker"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Traits"
          hint="Optional. Comma-separated traits to attach to this application."
          placeholder="control:invoke"
          value={traits}
          onChange={(e) => setTraits(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function SecretModal({
  secret,
  onClose,
  onCopied,
}: {
  secret: { name: string; clientSecret: string } | null;
  onClose: () => void;
  onCopied: () => void;
}) {
  return (
    <Modal
      open={secret !== null}
      onClose={onClose}
      title="Store the client secret now"
      description="This secret is shown once and cannot be retrieved later. Copy it before closing."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {secret ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground">{secret.name}</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
              {secret.clientSecret}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(secret.clientSecret);
                onCopied();
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
