/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Pure presenter that turns the Operator turn ledger into a display timeline and the latest plan's reviewable state.
*/
import type { OperatorTurn } from "@/platform/api/types";

export type TimelineRole = "user" | "operator" | "system";

export interface MessageItem {
  kind: "message" | "note";
  id: string;
  seq: number;
  role: TimelineRole;
  text: string;
  // The model's chain of thought, present when a reasoning model exposed it on an
  // operator note. Absent for user messages and answers with no reasoning.
  reasoning?: string;
}

export interface PlanStepView {
  id: string;
  capability: string;
  summary: string;
  mutating: boolean;
  args: Record<string, unknown>;
  status: "pending" | "succeeded" | "failed";
  detail?: string;
}

export type AdvisorySeverity = "info" | "caution" | "warning";

export interface AdvisoryFindingView {
  severity: AdvisorySeverity;
  concern: string;
}

// The advisory security review a composed plan may carry. Informational only — it is surfaced to
// the reviewer and never changes whether the plan can be approved or applied.
export interface PlanAdvisoryView {
  summary: string;
  findings: AdvisoryFindingView[];
}

export interface PlanItem {
  kind: "plan";
  id: string;
  seq: number;
  summary: string;
  steps: PlanStepView[];
  decision: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  executed: boolean;
  // Whether the plan can still be acted on: a pending plan can be approved or
  // rejected; an approved, not-yet-executed plan can be applied.
  canDecide: boolean;
  canExecute: boolean;
  // The advisory security review, present only for a composed plan that carried one.
  advisory?: PlanAdvisoryView;
}

export interface ErrorItem {
  kind: "error";
  id: string;
  seq: number;
  message: string;
}

export type TimelineItem = MessageItem | PlanItem | ErrorItem;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

interface RawPlanStep {
  id: string;
  capability: string;
  summary: string;
  mutating: boolean;
  args: Record<string, unknown>;
}

function readPlanSteps(content: Record<string, unknown>): RawPlanStep[] {
  const steps = Array.isArray(content.steps) ? content.steps : [];
  return steps.map((raw) => {
    const step = asRecord(raw);
    return {
      id: asString(step.id),
      capability: asString(step.capability),
      summary: asString(step.summary),
      mutating: step.mutating === true,
      args: asRecord(step.args),
    };
  });
}

// Reads the advisory security review from a plan turn's content, when present. Only the recognized
// severities are kept and a finding must carry a concern, so a malformed advisory degrades to
// nothing rather than rendering noise. Returns undefined when the plan carried no advisory.
function readPlanAdvisory(content: Record<string, unknown>): PlanAdvisoryView | undefined {
  const advisory = asRecord(content.advisory);
  const summary = asString(advisory.summary);
  if (summary.length === 0) return undefined;
  const rawFindings = Array.isArray(advisory.findings) ? advisory.findings : [];
  const findings: AdvisoryFindingView[] = [];
  for (const raw of rawFindings) {
    const finding = asRecord(raw);
    const severity = finding.severity;
    const concern = asString(finding.concern);
    if (
      (severity === "info" || severity === "caution" || severity === "warning") &&
      concern.length > 0
    ) {
      findings.push({ severity, concern });
    }
  }
  return { summary, findings };
}

// Builds the display timeline from the ordered turn ledger and resolves the latest
// plan's reviewable state by folding the approval, rejection, and execution turns
// that reference it. The presenter is the single place the UI learns whether a plan
// can be approved or applied, so those controls cannot drift from the ledger.
export function buildTimeline(turns: OperatorTurn[]): {
  items: TimelineItem[];
  latestPlan: PlanItem | null;
} {
  const ordered = [...turns].sort((a, b) => a.seq - b.seq);

  let latestPlanSeq: number | null = null;
  for (const turn of ordered) {
    if (turn.kind === "plan") latestPlanSeq = turn.seq;
  }

  const items: TimelineItem[] = [];
  let latestPlan: PlanItem | null = null;

  for (const turn of ordered) {
    if (turn.kind === "message" || turn.kind === "note") {
      const content = asRecord(turn.content);
      const reasoning = asString(content.reasoning);
      items.push({
        kind: turn.kind,
        id: turn.id,
        seq: turn.seq,
        role: turn.role,
        text: asString(content.text),
        reasoning: reasoning.length > 0 ? reasoning : undefined,
      });
    } else if (turn.kind === "error") {
      items.push({
        kind: "error",
        id: turn.id,
        seq: turn.seq,
        message: asString(asRecord(turn.content).message),
      });
    } else if (turn.kind === "plan") {
      const content = asRecord(turn.content);
      const plan = resolvePlan(
        turn,
        readPlanSteps(content),
        asString(content.summary),
        readPlanAdvisory(content),
        ordered,
      );
      items.push(plan);
      if (turn.seq === latestPlanSeq) latestPlan = plan;
    }
  }

  return { items, latestPlan };
}

function resolvePlan(
  planTurn: OperatorTurn,
  steps: RawPlanStep[],
  summary: string,
  advisory: PlanAdvisoryView | undefined,
  ordered: OperatorTurn[],
): PlanItem {
  let decision: PlanItem["decision"] = "pending";
  let rejectionReason: string | null = null;
  let executed = false;
  const stepStatus = new Map<string, { status: "succeeded" | "failed"; detail?: string }>();

  for (const turn of ordered) {
    if (turn.seq <= planTurn.seq) continue;
    const content = asRecord(turn.content);
    if (content.plan_seq !== planTurn.seq) continue;
    if (turn.kind === "approval") {
      decision = "approved";
      rejectionReason = null;
    } else if (turn.kind === "rejection") {
      decision = "rejected";
      rejectionReason = asString(content.reason) || null;
    } else if (turn.kind === "execution") {
      executed = true;
      const status = content.status === "failed" ? "failed" : "succeeded";
      stepStatus.set(asString(content.step_id), {
        status,
        detail: asString(content.detail) || undefined,
      });
    }
  }

  const stepViews: PlanStepView[] = steps.map((step) => {
    const exec = stepStatus.get(step.id);
    return {
      id: step.id,
      capability: step.capability,
      summary: step.summary,
      mutating: step.mutating,
      args: step.args,
      status: exec?.status ?? "pending",
      ...(exec?.detail ? { detail: exec.detail } : {}),
    };
  });

  return {
    kind: "plan",
    id: planTurn.id,
    seq: planTurn.seq,
    summary,
    steps: stepViews,
    decision,
    rejectionReason,
    executed,
    canDecide: decision === "pending",
    canExecute: decision === "approved" && !executed,
    ...(advisory ? { advisory } : {}),
  };
}
