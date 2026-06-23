/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the policy-set composer for selecting policy versions into an immutable manifest.
*/
import { useEffect, useState } from "react";

import { Button, Field, Modal, Skeleton } from "@/components/ui";
import { cx } from "@/lib/cx";
import { consoleApi } from "@/platform/api/client";
import type { Policy, PolicyManifestEntry } from "@/platform/api/types";

interface PolicyChoice {
  policyId: string;
  name: string;
  versions: { id: string; version: number }[];
}

export interface ComposerResult {
  name?: string;
  description?: string;
  manifest: PolicyManifestEntry[];
  activateNow: boolean;
}

export function PolicySetComposer({
  open,
  mode,
  zoneId,
  policies,
  policySetName,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "version";
  zoneId: string;
  policies: Policy[];
  policySetName?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (result: ComposerResult) => void;
}) {
  const isCreate = mode === "create";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activateNow, setActivateNow] = useState(true);
  const [choices, setChoices] = useState<PolicyChoice[] | null>(null);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setActivateNow(true);
    setSelected(new Map());
    setError(null);
    setChoices(null);

    let cancelled = false;
    (async () => {
      try {
        const details = await Promise.all(
          policies.map((policy) => consoleApi.policies.get(zoneId, policy.id)),
        );
        if (cancelled) return;
        const resolved: PolicyChoice[] = details
          .map((detail) => ({
            policyId: detail.id,
            name: detail.name,
            versions: (detail.versions ?? [])
              .map((v) => ({ id: v.id, version: v.version }))
              .sort((a, b) => b.version - a.version),
          }))
          .filter((choice) => choice.versions.length > 0);
        setChoices(resolved);
      } catch {
        if (!cancelled) setError("Could not load policy versions.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, zoneId, policies]);

  function toggle(choice: PolicyChoice) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(choice.policyId)) next.delete(choice.policyId);
      else next.set(choice.policyId, choice.versions[0].id);
      return next;
    });
  }

  function setVersion(policyId: string, versionId: string) {
    setSelected((prev) => new Map(prev).set(policyId, versionId));
  }

  function submit() {
    if (isCreate && !name.trim()) {
      setError("Policy set name is required.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one policy version.");
      return;
    }
    const manifest: PolicyManifestEntry[] = Array.from(selected.values()).map(
      (policy_version_id) => ({
        policy_version_id,
      }),
    );
    onSubmit({
      manifest,
      activateNow,
      ...(isCreate ? { name: name.trim(), description: description.trim() || undefined } : {}),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCreate ? "New policy set" : `New version · ${policySetName ?? ""}`}
      description={
        isCreate
          ? "Compose policy versions into a set. Activating a set makes it govern every decision in the zone."
          : "Compose a new immutable version of this set from policy versions."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={(isCreate && !name.trim()) || selected.size === 0}
          >
            {activateNow ? "Compose & activate" : "Compose version"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto pr-1">
        {isCreate ? (
          <>
            <Field
              label="Name"
              placeholder="production-authz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Field
              label="Description"
              placeholder="Optional summary of what this set enforces"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Policy versions</span>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          </div>

          {choices === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : choices.length === 0 ? (
            <p className="border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No policies with versions exist yet. Create a policy first.
            </p>
          ) : (
            <ul className="divide-y divide-border border border-border">
              {choices.map((choice) => {
                const checked = selected.has(choice.policyId);
                return (
                  <li
                    key={choice.policyId}
                    className={cx(
                      "flex items-center gap-3 px-3 py-2.5 transition-colors",
                      checked && "bg-surface",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(choice)}
                      className="h-4 w-4 flex-shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {choice.name}
                    </span>
                    <select
                      value={selected.get(choice.policyId) ?? choice.versions[0].id}
                      onChange={(e) => setVersion(choice.policyId, e.target.value)}
                      disabled={!checked}
                      className="h-8 flex-shrink-0 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground outline-none focus:border-ring disabled:opacity-50"
                    >
                      {choice.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <label className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span>
            <span className="block text-sm font-medium text-foreground">Activate immediately</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Make this version govern every decision in the zone as soon as it is composed.
            </span>
          </span>
          <input
            type="checkbox"
            checked={activateNow}
            onChange={(e) => setActivateNow(e.target.checked)}
            className="h-4 w-4 flex-shrink-0 accent-primary"
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Modal>
  );
}
