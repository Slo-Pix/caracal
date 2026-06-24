/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Rego policy editor with inline validation for authoring policies and versions.
*/
import { useEffect, useRef, useState } from "react";

import { Button, Field, Modal } from "@/components/ui";
import { cx } from "@/lib/cx";
import { consoleApi } from "@/platform/api/client";
import type { PolicyValidateResult } from "@/platform/api/types";

const STARTER = `package caracal.authz

import rego.v1

default result := {"decision": "deny", "evaluation_status": "complete"}

result := {"decision": "allow", "evaluation_status": "complete"} if {
\tinput.subject.traits[_] == "billing:read"
}
`;

type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "valid"; result: PolicyValidateResult }
  | { status: "invalid"; message: string };

export function PolicyEditorModal({
  open,
  mode,
  policyName,
  initialContent,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "version";
  policyName?: string;
  initialContent?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { name?: string; description?: string; content: string }) => void;
}) {
  const isCreate = mode === "create";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" });
  const seedRef = useRef("");

  if (open && seedRef.current !== `${open}:${mode}:${policyName ?? ""}`) {
    seedRef.current = `${open}:${mode}:${policyName ?? ""}`;
    setName("");
    setDescription("");
    setContent(initialContent ?? (isCreate ? STARTER : ""));
    setValidation({ status: "idle" });
  }

  // Validation is invalidated whenever content changes.
  useEffect(() => {
    setValidation({ status: "idle" });
  }, [content]);

  async function validate(): Promise<boolean> {
    if (!content.trim()) {
      setValidation({ status: "invalid", message: "Policy content is required." });
      return false;
    }
    setValidation({ status: "validating" });
    try {
      const result = await consoleApi.policies.validate(content);
      if (result.valid) {
        setValidation({ status: "valid", result });
        return true;
      }
      setValidation({
        status: "invalid",
        message: result.detail ?? result.error ?? "Invalid Rego.",
      });
      return false;
    } catch (error) {
      const message =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "Validation failed.";
      setValidation({ status: "invalid", message });
      return false;
    }
  }

  async function submit() {
    if (isCreate && !name.trim()) return;
    const ok = await validate();
    if (!ok) return;
    onSubmit({
      content,
      ...(isCreate ? { name: name.trim(), description: description.trim() || undefined } : {}),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCreate ? "New policy" : `New version · ${policyName ?? ""}`}
      description={
        isCreate
          ? "Author a Rego authorization rule. It is validated before it is saved."
          : "Add an immutable version. Existing versions are never modified."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void validate()} disabled={busy}>
            Validate
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={isCreate && !name.trim()}>
            {isCreate ? "Validate & create" : "Validate & add version"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto pr-1">
        {isCreate ? (
          <>
            <Field
              label="Name"
              placeholder="billing-read-access"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Field
              label="Description"
              placeholder="Optional summary of what this policy authorizes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Rego source</span>
            <label className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground">
              Load from file
              <input
                type="file"
                accept=".rego,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setContent(String(reader.result ?? ""));
                    setValidation({ status: "idle" });
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            rows={16}
            className="scrollbar-thin w-full resize-y rounded-md border border-border bg-[#0d1117] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#e6edf3] outline-none focus:border-ring dark:bg-[#0d1117]"
            placeholder="package caracal.authz…"
          />
        </div>

        <ValidationBanner state={validation} />
      </div>
    </Modal>
  );
}

function ValidationBanner({ state }: { state: ValidationState }) {
  if (state.status === "idle") {
    return (
      <p className="text-xs text-muted-foreground">
        Validation checks Rego syntax and the policy contract before saving.
      </p>
    );
  }
  if (state.status === "validating") {
    return <p className="text-xs text-muted-foreground">Validating…</p>;
  }
  if (state.status === "valid") {
    return (
      <div className="flex items-start gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
        <Dot className="bg-emerald-500" />
        <div>
          <div className="font-medium">Valid policy</div>
          <div className="mt-0.5 text-emerald-700/80 dark:text-emerald-400/80">
            Schema {state.result.schema_version ?? "current"} · contract caracal.authz.result
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <Dot className="bg-destructive" />
      <div>
        <div className="font-medium">Validation failed</div>
        <div className="mt-0.5 whitespace-pre-wrap break-words text-destructive/80">
          {state.message}
        </div>
      </div>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span className={cx("mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full", className)} />
  );
}
