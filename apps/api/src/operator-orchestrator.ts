// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// The Operator orchestrator: a skill registry and a per-turn dispatcher that triages a request to its tier and runs the one skill that handles it.

import {
  runTriage,
  tierPlans,
  runPlanner,
  runExplainer,
  type AgentContext,
  type AgentResult,
  type OperatorTier,
} from './operator-agents.js'
import type { ProposedPlanInput } from './operator-capabilities.js'
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
// a plan is validated, previewed, and stored for approval; an answer is recorded as a note.
export type OrchestrationOutcome =
  | { kind: 'plan'; result: AgentResult<ProposedPlanInput> }
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
  handle(gateway: Gateway, message: string, context: AgentContext): Promise<OrchestrationResult>
}

// Builds the orchestrator over a skill registry. Per turn it triages the request to its tier
// then runs the one skill the registry maps that tier to. A triage that fails the schema
// defaults to the read tier, which answers as text and never acts — the safe direction on
// ambiguity. The orchestrator selects and runs a skill; it never validates, previews, persists,
// or applies — those stay in the deterministic spine the route owns.
export function createOrchestrator(registry: SkillRegistry = createSkillRegistry()): Orchestrator {
  return {
    async handle(gateway, message, context): Promise<OrchestrationResult> {
      const triage = await runTriage(gateway, message)
      const tier: OperatorTier = triage.ok ? triage.value : 'read'
      const skill = registry.forTier(tier)
      if (skill.kind === 'plan') {
        return { tier, outcome: { kind: 'plan', result: await skill.run(gateway, message, context) } }
      }
      return { tier, outcome: { kind: 'answer', result: await skill.run(gateway, message, context) } }
    },
  }
}
