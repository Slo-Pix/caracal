/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Control API developer workspace: keys, scopes, authentication, and usage.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  Tabs,
  useToast,
  type Column,
} from "@/components/ui";
import { cx } from "@/lib/cx";
import {
  CONTROL_MAX_TTL_SECONDS,
  CONTROL_MIN_TTL_SECONDS,
  CONTROL_NOUN_DESCRIPTIONS,
  CONTROL_PERMISSIONS,
  ConsoleApiError,
} from "@/platform/api/client";
import {
  useControlKeys,
  useControlStatus,
  useCreateControlKey,
  useDisableControl,
  useEnableControl,
  useIssueControlToken,
  useRevokeControlKey,
  useRotateControlKey,
} from "@/platform/api/hooks";
import type { ControlKey, ControlKeyCreateResult, ControlTokenResult } from "@/platform/api/types";

export const Route = createFileRoute("/app/control")({
  component: ControlRoute,
});

function ControlRoute() {
  return (
    <ZoneScopedPage
      title="Control API"
      description="Programmatic, scoped automation of zone management."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Control API" }]}
    >
      {(zone) => <ControlPage zoneId={zone.id} zoneSlug={zone.slug} />}
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

type TabId = "keys" | "auth" | "reference";

function ControlPage({ zoneId, zoneSlug }: { zoneId: string; zoneSlug: string }) {
  const [tab, setTab] = useState<TabId>("keys");
  const keysQuery = useControlKeys(zoneId);
  const keys = useMemo(() => keysQuery.data ?? [], [keysQuery.data]);

  const tabs = (
    <Tabs
      tabs={[
        { id: "keys", label: "Keys", count: keys.length },
        { id: "auth", label: "Authentication" },
        { id: "reference", label: "Reference" },
      ]}
      active={tab}
      onChange={(id) => setTab(id as TabId)}
    />
  );

  if (tab === "keys") {
    return (
      <ControlKeysTab
        zoneId={zoneId}
        keys={keys}
        loading={keysQuery.isLoading}
        error={keysQuery.isError ? errorMessage(keysQuery.error) : null}
        headerExtra={tabs}
      />
    );
  }

  return (
    <ResourceWorkspaceShell headerExtra={tabs}>
      {tab === "auth" ? <AuthTab zoneId={zoneId} /> : <ReferenceTab zoneSlug={zoneSlug} />}
    </ResourceWorkspaceShell>
  );
}

function ResourceWorkspaceShell({
  headerExtra,
  children,
}: {
  headerExtra: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Control API</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
          Programmatic, scoped automation of zone management.
        </p>
      </div>
      <div className="mb-4">{headerExtra}</div>
      {children}
    </div>
  );
}

/* ------------------------------- Keys tab ------------------------------- */

function ControlKeysTab({
  zoneId,
  keys,
  loading,
  error,
  headerExtra,
}: {
  zoneId: string;
  keys: ControlKey[];
  loading: boolean;
  error: string | null;
  headerExtra: ReactNode;
}) {
  const toast = useToast();
  const rotateKey = useRotateControlKey(zoneId);
  const revokeKey = useRevokeControlKey(zoneId);
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ControlKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ControlKey | null>(null);
  const [issueTarget, setIssueTarget] = useState<ControlKey | null>(null);
  const [tokenResult, setTokenResult] = useState<ControlTokenResult | null>(null);

  const columns: Column<ControlKey>[] = [
    {
      id: "name",
      header: "Key",
      sortable: true,
      cell: (k) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{k.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{k.id}</div>
        </div>
      ),
    },
    {
      id: "scopes",
      header: "Permissions",
      cell: (k) => (
        <span className="text-xs text-muted-foreground">
          {k.scopes.length} scope{k.scopes.length === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "ttl",
      header: "Max TTL",
      cell: (k) => (
        <span className="text-xs text-muted-foreground">
          {k.maxTtlSeconds ? `${k.maxTtlSeconds}s` : "default"}
        </span>
      ),
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      align: "right",
      cell: (k) => (
        <span className="text-xs text-muted-foreground">
          {new Date(k.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <ResourceWorkspace
        title="Control API"
        description="Programmatic, scoped automation of zone management."
        breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Control API" }]}
        primaryAction={{ label: "New control key", onClick: () => setCreateOpen(true) }}
        headerExtra={
          <div className="flex flex-col gap-4">
            {headerExtra}
            <EndpointStatusBar />
            <IssuanceNotice />
          </div>
        }
        rows={keys}
        loading={loading}
        columns={columns}
        rowKey={(k) => k.id}
        search={{
          placeholder: "Search control keys…",
          match: (k, q) =>
            k.name.toLowerCase().includes(q) ||
            k.id.toLowerCase().includes(q) ||
            k.scopes.some((s) => s.toLowerCase().includes(q)),
        }}
        sortOptions={[
          { id: "name", label: "Name" },
          { id: "recent", label: "Newest" },
        ]}
        empty={{
          title: error ? "Could not load control keys" : "No control keys yet",
          description:
            error ??
            "Control keys grant scoped, zone-bound automation. Create one to drive zone management from the Control API.",
        }}
        detail={{
          title: (k) => k.name,
          description: (k) => k.id,
          width: "max-w-2xl",
          render: (k) => (
            <ControlKeyInspector
              keyRecord={k}
              onRotate={() => setRotateTarget(k)}
              onRevoke={() => setRevokeTarget(k)}
              onIssueToken={() => setIssueTarget(k)}
            />
          ),
        }}
      />

      <CreateControlKeyModal
        open={createOpen}
        zoneId={zoneId}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          setSecret({ id: result.id, name: result.name, secret: result.clientSecret });
        }}
      />

      <ControlSecretModal secret={secret} onClose={() => setSecret(null)} />

      <ConfirmDialog
        open={rotateTarget !== null}
        onClose={() => setRotateTarget(null)}
        title="Rotate client secret"
        description={`This immediately invalidates the current secret for "${rotateTarget?.name ?? ""}". Any automation using the old secret fails until updated with the new one.`}
        confirmLabel="Rotate secret"
        tone="danger"
        onConfirm={async () => {
          if (!rotateTarget) return;
          try {
            const res = await rotateKey.mutateAsync(rotateTarget.id);
            setSecret({ id: rotateTarget.id, name: rotateTarget.name, secret: res.clientSecret });
          } catch (err) {
            toast({ tone: "error", title: "Rotation failed", description: errorMessage(err) });
          }
        }}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke control key"
        description={`Revoking "${revokeTarget?.name ?? ""}" permanently disables it. Any automation using it stops working immediately. This cannot be undone.`}
        confirmLabel="Revoke key"
        tone="danger"
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeKey.mutateAsync(revokeTarget.id);
            toast({ tone: "info", title: "Control key revoked", description: revokeTarget.name });
          } catch (err) {
            toast({ tone: "error", title: "Revoke failed", description: errorMessage(err) });
          }
        }}
      />

      <IssueTokenModal
        zoneId={zoneId}
        keyRecord={issueTarget}
        onClose={() => setIssueTarget(null)}
        onIssued={(result) => {
          setIssueTarget(null);
          setTokenResult(result);
        }}
      />

      <TokenResultModal result={tokenResult} onClose={() => setTokenResult(null)} />
    </>
  );
}

function IssuanceNotice() {
  return (
    <div className="flex items-start gap-3 border border-border bg-muted/30 px-4 py-3">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="mt-0.5 shrink-0 text-muted-foreground"
      >
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <div className="min-w-0 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">The client secret is shown only once.</span>{" "}
        It is generated in your browser, never stored, and cannot be retrieved later, so copy it
        before closing the dialog.
      </div>
    </div>
  );
}

// Composes least-privilege control scopes from the permission catalog and optional TTL/
// expiry guards. Every constraint is validated before submit so operators never discover
// a rejected key after the fact.
function CreateControlKeyModal({
  open,
  zoneId,
  onClose,
  onCreated,
}: {
  open: boolean;
  zoneId: string;
  onClose: () => void;
  onCreated: (result: ControlKeyCreateResult) => void;
}) {
  const create = useCreateControlKey(zoneId);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxTtl, setMaxTtl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, typeof CONTROL_PERMISSIONS>();
    for (const permission of CONTROL_PERMISSIONS) {
      const list = map.get(permission.command) ?? [];
      list.push(permission);
      map.set(permission.command, list);
    }
    return [...map.entries()];
  }, []);

  function reset() {
    setName("");
    setSelected(new Set());
    setMaxTtl("");
    setExpiresAt("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function toggle(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("A key name is required.");
    if (selected.size === 0) return setError("Select at least one permission.");
    let maxTtlSeconds: number | undefined;
    if (maxTtl.trim()) {
      const parsed = Number.parseInt(maxTtl, 10);
      if (
        !Number.isInteger(parsed) ||
        parsed < CONTROL_MIN_TTL_SECONDS ||
        parsed > CONTROL_MAX_TTL_SECONDS
      ) {
        return setError(
          `Max token TTL must be between ${CONTROL_MIN_TTL_SECONDS} and ${CONTROL_MAX_TTL_SECONDS} seconds.`,
        );
      }
      maxTtlSeconds = parsed;
    }
    let expiresIso: string | undefined;
    if (expiresAt.trim()) {
      const ts = Date.parse(expiresAt);
      if (!Number.isFinite(ts)) return setError("Expiry must be a valid date and time.");
      if (ts <= Date.now()) return setError("Expiry must be in the future.");
      expiresIso = new Date(ts).toISOString();
    }
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        scopes: [...selected],
        maxTtlSeconds,
        expiresAt: expiresIso,
      });
      reset();
      onCreated(result);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New control key"
      description="Scoped, zone-bound automation credential."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create key
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Name"
          placeholder="ci-deploy-bot"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Permissions ({selected.size})
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                setSelected((prev) =>
                  prev.size === CONTROL_PERMISSIONS.length
                    ? new Set()
                    : new Set(CONTROL_PERMISSIONS.map((p) => p.scope)),
                )
              }
            >
              {selected.size === CONTROL_PERMISSIONS.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {groups.map(([command, permissions]) => (
              <div key={command} className="border border-border">
                <div className="border-b border-border bg-muted/30 px-3 py-1.5 font-mono text-xs font-semibold text-foreground">
                  {command}
                </div>
                <div className="flex flex-wrap gap-1.5 p-2">
                  {permissions.map((permission) => {
                    const on = selected.has(permission.scope);
                    return (
                      <button
                        key={permission.scope}
                        type="button"
                        onClick={() => toggle(permission.scope)}
                        title={permission.summary}
                        className={cx(
                          "rounded border px-2 py-1 font-mono text-[11px] transition-colors",
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:border-foreground/40",
                        )}
                      >
                        {permission.verb}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Advanced: token guards
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Max token TTL (seconds)"
              type="number"
              min={CONTROL_MIN_TTL_SECONDS}
              max={CONTROL_MAX_TTL_SECONDS}
              placeholder="default"
              hint={`${CONTROL_MIN_TTL_SECONDS}–${CONTROL_MAX_TTL_SECONDS}s`}
              value={maxTtl}
              onChange={(e) => setMaxTtl(e.target.value)}
            />
            <Field
              label="Key expiry"
              type="datetime-local"
              hint="Optional. Key stops issuing tokens after this."
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </details>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Modal>
  );
}

function ControlSecretModal({
  secret,
  onClose,
}: {
  secret: { id: string; name: string; secret: string } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  return (
    <Modal
      open={secret !== null}
      onClose={onClose}
      title="Control key secret"
      description="Copy the client secret now. It is never shown again."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {secret ? (
        <div className="flex flex-col gap-4">
          <DetailGroup title={secret.name}>
            <DetailField label="Client ID">
              <Mono>{secret.id}</Mono>
            </DetailField>
          </DetailGroup>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Client secret</span>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={secret.secret}
                className="min-w-0 flex-1 border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(secret.secret);
                  toast({ tone: "success", title: "Secret copied" });
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Store it in your automation&apos;s secret manager as <Mono>CARACAL_CONTROL_SECRET</Mono>
            .
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function ControlKeyInspector({
  keyRecord,
  onRotate,
  onRevoke,
  onIssueToken,
}: {
  keyRecord: ControlKey;
  onRotate: () => void;
  onRevoke: () => void;
  onIssueToken: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onRotate}>
          Rotate secret
        </Button>
        <Button variant="danger" size="sm" onClick={onRevoke}>
          Revoke
        </Button>
      </div>
      <DetailGroup title="Key">
        <DetailField label="Name">{keyRecord.name}</DetailField>
        <DetailField label="Client ID">
          <Mono>{keyRecord.id}</Mono>
        </DetailField>
        <DetailField label="Max TTL">
          {keyRecord.maxTtlSeconds ? `${keyRecord.maxTtlSeconds}s` : "Zone default"}
        </DetailField>
        {keyRecord.expiresAt ? (
          <DetailField label="Expires">
            {new Date(keyRecord.expiresAt).toLocaleString()}
          </DetailField>
        ) : null}
        <DetailField label="Created">{new Date(keyRecord.createdAt).toLocaleString()}</DetailField>
      </DetailGroup>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Permissions ({keyRecord.scopes.length})
        </h3>
        {keyRecord.scopes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keyRecord.scopes.map((scope) => (
              <span
                key={scope}
                className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {scope}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No scoped permissions: this key can authenticate but invokes nothing.
          </p>
        )}
      </section>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Restrictions
        </h3>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {["zone-bound", "application-only", "no-subject-token", "no-delegation"].map((r) => (
            <li key={r} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span className="font-mono">{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Exchange for an invocation token
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste the key&apos;s one-time secret to mint a short-lived, least-privilege STS token
          scoped to this key. The token is generated on demand and never stored.
        </p>
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onIssueToken}
            disabled={keyRecord.scopes.length === 0}
          >
            Issue token
          </Button>
          {keyRecord.scopes.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              This key grants no scopes, so it can authenticate but invoke nothing.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function IssueTokenModal({
  zoneId,
  keyRecord,
  onClose,
  onIssued,
}: {
  zoneId: string;
  keyRecord: ControlKey | null;
  onClose: () => void;
  onIssued: (result: ControlTokenResult) => void;
}) {
  const issue = useIssueControlToken(zoneId);
  const [clientSecret, setClientSecret] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ttl, setTtl] = useState("300");
  const [error, setError] = useState<string | null>(null);

  const keyScopes = keyRecord?.scopes ?? [];
  const keyId = keyRecord?.id ?? null;
  // Reset the form whenever the targeted key changes (including close/reopen) so a stale
  // secret or scope set never leaks across keys.
  useEffect(() => {
    setClientSecret("");
    setSelected(new Set(keyScopes));
    setTtl("300");
    setError(null);
    // keyScopes is derived from keyId; keying the effect on keyId is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  const ttlOptions = ["300", "600", "900"].filter(
    (option) => !keyRecord?.maxTtlSeconds || Number.parseInt(option, 10) <= keyRecord.maxTtlSeconds,
  );
  const effectiveTtls =
    ttlOptions.length > 0 ? ttlOptions : [String(keyRecord?.maxTtlSeconds ?? 300)];

  function toggle(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function submit() {
    if (!keyRecord) return;
    setError(null);
    if (!clientSecret.trim()) return setError("Paste the key's client secret.");
    if (selected.size === 0) return setError("Select at least one permission.");
    const ttlSeconds = Number.parseInt(effectiveTtls.includes(ttl) ? ttl : effectiveTtls[0], 10);
    try {
      const result = await issue.mutateAsync({
        keyId: keyRecord.id,
        clientSecret: clientSecret.trim(),
        scopes: [...selected],
        ttlSeconds,
      });
      onIssued(result);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      open={keyRecord !== null}
      onClose={onClose}
      title="Issue invocation token"
      description={keyRecord ? `Mint a token for "${keyRecord.name}".` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={issue.isPending}>
            Issue token
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Client secret"
          type="password"
          placeholder="cs_…"
          hint="The one-time secret shown when the key was created or rotated."
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          autoFocus
        />
        <div>
          <span className="mb-2 block text-sm font-medium text-foreground">
            Permissions ({selected.size})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {keyScopes.map((scope) => {
              const on = selected.has(scope);
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggle(scope)}
                  className={cx(
                    "rounded border px-2 py-1 font-mono text-[11px] transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {scope}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A token can never exceed the scopes granted to its key.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Token TTL (seconds)</span>
          <select
            value={effectiveTtls.includes(ttl) ? ttl : effectiveTtls[0]}
            onChange={(e) => setTtl(e.target.value)}
            className="border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {effectiveTtls.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Modal>
  );
}

function TokenResultModal({
  result,
  onClose,
}: {
  result: ControlTokenResult | null;
  onClose: () => void;
}) {
  const toast = useToast();
  return (
    <Modal
      open={result !== null}
      onClose={onClose}
      title="Invocation token"
      description="Copy the token now. It is short-lived and never shown again."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <DetailGroup title="Token">
            <DetailField label="Resource">
              <Mono>{result.resource}</Mono>
            </DetailField>
            <DetailField label="Type">{result.tokenType}</DetailField>
            <DetailField label="Invoke path">
              <Mono>{result.invokePath}</Mono>
            </DetailField>
          </DetailGroup>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Access token</span>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={result.accessToken}
                className="min-w-0 flex-1 border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.accessToken);
                  toast({ tone: "success", title: "Token copied" });
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Scopes ({result.scopes.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function EndpointStatusBar() {
  const toast = useToast();
  const statusQuery = useControlStatus();
  const enable = useEnableControl();
  const disable = useDisableControl();
  const [confirmAction, setConfirmAction] = useState<"enable" | "disable" | null>(null);
  const status = statusQuery.data;

  if (statusQuery.isLoading) {
    return (
      <div className="border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Checking Control endpoint…
      </div>
    );
  }
  if (!status || !status.manageable) {
    return (
      <div className="border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Control endpoint management is unavailable on this host. Keys can still be created and used
        against a running Control endpoint.
      </div>
    );
  }

  const enabled = status.enabled === true;
  const runtimeTone =
    status.service === "ok" ? "success" : status.service === "down" ? "danger" : "neutral";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge tone={enabled ? "success" : "neutral"}>
              {enabled ? "Endpoint enabled" : "Endpoint disabled"}
            </Badge>
            {enabled ? <Badge tone={runtimeTone}>{status.service ?? "unknown"}</Badge> : null}
          </div>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {enabled ? status.invokeUrl : `not exposed (${status.invokeUrl ?? "—"})`}
          </span>
        </div>
        <Button
          size="sm"
          variant={enabled ? "danger" : "primary"}
          loading={enable.isPending || disable.isPending}
          onClick={() => setConfirmAction(enabled ? "disable" : "enable")}
        >
          {enabled ? "Disable endpoint" : "Enable endpoint"}
        </Button>
      </div>

      <details className="border border-t-0 border-border bg-muted/30 px-4 pb-3">
        <summary className="cursor-pointer py-2 text-xs font-medium text-muted-foreground">
          Endpoint details
        </summary>
        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <StatusRow label="Lifecycle" value={status.lifecycle} />
          <StatusRow label="Runtime" value={status.service} />
          <StatusRow label="Health" value={status.detail} />
          <StatusRow label="Optimization" value={status.optimization} />
          <StatusRow label="Health URL" value={status.healthUrl} mono />
          <StatusRow label="Ready URL" value={status.readyUrl} mono />
          <StatusRow label="Gate file" value={status.marker} mono />
        </dl>
      </details>

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "disable" ? "Disable Control endpoint" : "Enable Control endpoint"}
        description={
          confirmAction === "disable"
            ? "Closes the local Control endpoint gate. Automation calling the Control API stops working until re-enabled."
            : "Opens the local Control endpoint gate so authenticated automation can call the Control API. The API service must be running."
        }
        confirmLabel={confirmAction === "disable" ? "Disable" : "Enable"}
        tone={confirmAction === "disable" ? "danger" : "primary"}
        onConfirm={async () => {
          const action = confirmAction;
          try {
            if (action === "disable") await disable.mutateAsync();
            else await enable.mutateAsync();
            toast({
              tone: "success",
              title:
                action === "disable" ? "Control endpoint disabled" : "Control endpoint enabled",
            });
          } catch (err) {
            toast({
              tone: "error",
              title: "Control action failed",
              description: errorMessage(err),
            });
          }
        }}
      />
    </>
  );
}

function StatusRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-0.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cx("min-w-0 truncate text-foreground", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

/* --------------------------- Authentication tab --------------------------- */

function AuthTab({ zoneId }: { zoneId: string }) {
  return (
    <div className="grid gap-px border border-border bg-border lg:grid-cols-2 [&>*]:bg-background">
      <Panel title="How control authentication works">
        <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
          <Step n={1}>
            Create a control key in the <span className="font-medium text-foreground">Keys</span>{" "}
            tab. The one-time secret is shown once, in your browser.
          </Step>
          <Step n={2}>
            Exchange the key for a short-lived, least-privilege STS token scoped as{" "}
            <Mono>control:&lt;noun&gt;:&lt;verb&gt;</Mono> — use{" "}
            <span className="font-medium text-foreground">Issue token</span> on a key, or the STS
            client-credentials grant shown below.
          </Step>
          <Step n={3}>
            Call the Control API with the STS token. Every call is zone-bound and recorded in Audit.
          </Step>
        </ol>
      </Panel>
      <Panel title="Invoke an endpoint">
        <CodeBlock
          code={`# 1. Issue a token from the Keys tab (or exchange at STS directly)
TOKEN=...

# 2. Call the Control API
curl -s https://gateway.caracal.run/v1/control/invoke \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"noun":"agent","verb":"read","zone":"${zoneId}"}'`}
        />
      </Panel>
      <Panel title="Node SDK">
        <CodeBlock
          code={`import { ControlClient } from "@caracalai/sdk";

const control = new ControlClient({
  zone: "${zoneId}",
  clientId: process.env.CARACAL_CONTROL_ID,
  clientSecret: process.env.CARACAL_CONTROL_SECRET,
});

const agents = await control.agents.list();`}
        />
      </Panel>
      <Panel title="Python SDK">
        <CodeBlock
          code={`from caracalai import ControlClient

control = ControlClient(
    zone="${zoneId}",
    client_id=os.environ["CARACAL_CONTROL_ID"],
    client_secret=os.environ["CARACAL_CONTROL_SECRET"],
)

agents = control.agents.list()`}
        />
      </Panel>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------ Reference tab ------------------------------ */

interface SurfaceGroup {
  noun: string;
  description: string;
  actions: { verb: string; scope: string; summary: string }[];
}

// Derived from the single permission catalog so the reference can never drift from the
// scopes a key can actually be granted.
function buildSurface(): SurfaceGroup[] {
  const groups = new Map<string, SurfaceGroup>();
  for (const permission of CONTROL_PERMISSIONS) {
    let group = groups.get(permission.command);
    if (!group) {
      group = {
        noun: permission.command,
        description: CONTROL_NOUN_DESCRIPTIONS[permission.command] ?? "",
        actions: [],
      };
      groups.set(permission.command, group);
    }
    group.actions.push({
      verb: permission.verb,
      scope: permission.scope,
      summary: permission.summary,
    });
  }
  return [...groups.values()];
}

const SURFACE: SurfaceGroup[] = buildSurface();

function ReferenceTab({ zoneSlug }: { zoneSlug: string }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The Control API exposes zone management as <Mono>noun:verb</Mono> permissions. A control key
        is granted a subset of these scopes; its STS tokens can never exceed them. Operating on zone{" "}
        <Mono>{zoneSlug}</Mono>.
      </p>
      <div className="border border-border">
        {SURFACE.map((group, index) => (
          <div key={group.noun} className={cx(index > 0 && "border-t border-border")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="font-mono text-sm font-semibold text-foreground">{group.noun}</span>
              <span className="text-xs text-muted-foreground">{group.description}</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {group.actions.map((action) => (
                  <tr key={action.scope}>
                    <td className="w-24 px-4 py-2.5 align-top">
                      <Badge tone="neutral">{action.verb}</Badge>
                    </td>
                    <td className="px-4 py-2.5 align-top font-mono text-xs text-foreground">
                      {action.scope}
                    </td>
                    <td className="px-4 py-2.5 align-top text-xs text-muted-foreground">
                      {action.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- shared -------------------------------- */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const toast = useToast();
  return (
    <div className="group relative">
      <pre className="scrollbar-thin overflow-x-auto border border-border bg-[#0d1117] p-3 font-mono text-xs leading-relaxed text-[#e6edf3]">
        {code}
      </pre>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          toast({ tone: "success", title: "Copied" });
        }}
        className="absolute right-2 top-2 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/70 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
      >
        Copy
      </button>
    </div>
  );
}
