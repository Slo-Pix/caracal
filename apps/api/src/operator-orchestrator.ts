// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// The Operator orchestrator: a skill registry and a per-turn dispatcher that triages a request to its tier and runs the one skill that handles it.

import {
  runTriage,
  tierPlans,
  tierReadsState,
  tierComposes,
  runPlanner,
  runExplainer,
  runSecurityAnalyst,
  type AgentContext,
  type AgentResult,
  type OperatorTier,
  type SecurityAdvisory,
} from './operator-agents.js'
import type { ProposedPlanInput } from './operator-capabilities.js'
import type { Researcher } from './operator-research.js'
import type { Gateway } from './operator-gateway.js'

// A skill is a capability the orchestrator can invoke, not a pipeline stage. answer skills
// reply as text; plan skills produce a proposed plan the deterministic spine then governs. A
// skill holds no authority — it returns a typed artifact the route validates, previews, and
// (for plans) gates behind human approval. Later phases register more skills (researcher,
// validator, policy author, …) without changing the orchestrator.
export type SkillKind = 'answer' | 'plan'

export interface AnswerSkill {
  id: string
  kind: 'answer'
  run(gateway: Gateway, message: string, context: AgentContext): Promise<AgentResult<{ text: string; reasoning?: string }>>
}

export interface PlanSkill {
  id: string
  kind: 'plan'
  run(gateway: Gateway, message: string, context: AgentContext): Promise<AgentResult<ProposedPlanInput>>
}

export type Skill = AnswerSkill | PlanSkill

// The registry the orchestrator selects from. It maps each tier to exactly one handling skill,
// so the dispatch is deterministic: the LLM triages into a tier, and Caracal — not the model —
// decides which skill runs. Phases that add specialists register more skills and richer
// tier-to-skill maps here; the orchestrator's contract does not change.
export interface SkillRegistry {
  forTier(tier: OperatorTier): Skill
}

// The typed artifact a turn produced, tagged so the route runs the matching deterministic path:
// a plan is validated, previewed, and stored for approval; an answer is recorded as a note. A
// plan from a composing tier may carry an advisory security review — informational only, never
// gating — that the route surfaces to the human alongside the plan.
export type OrchestrationOutcome =
  | { kind: 'plan'; result: AgentResult<ProposedPlanInput>; advisory?: SecurityAdvisory }
  | { kind: 'answer'; result: AgentResult<{ text: string; reasoning?: string }> }

export interface OrchestrationResult {
  tier: OperatorTier
  outcome: OrchestrationOutcome
}

// The planning skill: the deterministic spine's proposer. It returns a proposed plan grounded
// in the capability catalog; the route validates and previews it before it is ever actionable.
const plannerSkill: PlanSkill = {
  id: 'planner',
  kind: 'plan',
  run: (gateway, message, context) => runPlanner(gateway, message, context),
}

// The read-only answering skill: explains state and decisions in plain language and never acts.
const explainerSkill: AnswerSkill = {
  id: 'explainer',
  kind: 'answer',
  run: (gateway, message, context) => runExplainer(gateway, message, context),
}

// The default registry: change and compound tiers plan; conversational and read tiers answer.
// This is exactly the tier split tierPlans encodes, surfaced as a registry so later phases swap
// in specialist skills per tier without touching the orchestrator.
export function createSkillRegistry(): SkillRegistry {
  return {
    forTier(tier: OperatorTier): Skill {
      return tierPlans(tier) ? plannerSkill : explainerSkill
    },
  }
}

export interface Orchestrator {
  handle(gateway: Gateway, message: string, context: AgentContext, options?: HandleOptions): Promise<OrchestrationResult>
}

// Per-turn collaborators the orchestrator may invoke. researcher is an ephemeral, read-only
// worker bound to the Operator's scoped identity; when present and the tier inspects state, the
// orchestrator gathers live evidence before answering. It is null when governed reads are not
// configured, in which case the answer falls back to conversation context alone.
export interface HandleOptions {
  researcher?: Researcher | null
}

// Gathers live state evidence and merges it into the context, without ever failing the turn. The
// researcher already isolates a single read's failure into a typed evidence entry; this also
// guards against an unexpected throw, degrading to the original context so the turn still
// produces a result. Returns the context unchanged when no researcher is available or no
// evidence could be gathered.
async function withEvidence(context: AgentContext, researcher: Researcher | null | undefined): Promise<AgentContext> {
  if (!researcher) return context
  try {
    const blackboard = await researcher.gather()
    return blackboard.evidence.length > 0 ? { ...context, evidence: blackboard.evidence } : context
  } catch {
    return context
  }
}

// Builds the orchestrator over a skill registry. Per turn it triages the request to its tier
// then runs the one skill the registry maps that tier to. A triage that fails the schema
// defaults to the read tier, which answers as text and never acts — the safe direction on
// ambiguity. A read tier grounds its answer in live state gathered through governed reads. A
// compound tier composes specialists: it gathers live state, plans against it, and runs an
// advisory security review over the proposed plan. Every plan — single or composed — still flows
// through the deterministic spine the route owns; the orchestrator selects and runs skills and
// gathers read-only evidence, and never validates, previews, persists, or applies, and the
// advisory it attaches only informs the human and never gates the plan.
export function createOrchestrator(registry: SkillRegistry = createSkillRegistry()): Orchestrator {
  return {
    async handle(gateway, message, context, options = {}): Promise<OrchestrationResult> {
      const triage = await runTriage(gateway, message)
      const tier: OperatorTier = triage.ok ? triage.value : 'read'
      const skill = registry.forTier(tier)

      if (skill.kind === 'plan') {
        // A compound request plans against freshly read live state; a single change does not, so
        // the common single-domain case stays the cheap single-skill path.
        const planContext = tierComposes(tier) ? await withEvidence(context, options.researcher) : context
        const result = await skill.run(gateway, message, planContext)
        // The advisory review runs only for a composed plan that actually proposes steps. It is
        // informational and never gates: a failed or absent review simply attaches nothing.
        if (tierComposes(tier) && result.ok && result.value.steps.length > 0) {
          const review = await runSecurityAnalyst(gateway, result.value, planContext)
          return { tier, outcome: { kind: 'plan', result, advisory: review.ok ? review.value : undefined } }
        }
        return { tier, outcome: { kind: 'plan', result } }
      }

      // A read tier inspects current state, so it answers grounded in freshly read evidence; a
      // conversational tier needs no state read and pays nothing.
      const answerContext = tierReadsState(tier) ? await withEvidence(context, options.researcher) : context
      return { tier, outcome: { kind: 'answer', result: await skill.run(gateway, message, answerContext) } }
    },
  }
}
