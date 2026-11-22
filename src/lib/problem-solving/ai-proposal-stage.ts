import type { AiProposalType } from "@/platform/ai/types";
import {
  SEMANTIC_STAGE_KEYS,
  type SemanticStageKey,
} from "@/lib/problem-solving/stages";

/** Method/UI keys that alias a canonical semantic stage key from `SEMANTIC_STAGE_KEYS`. */
const SEMANTIC_STAGE_ALIASES: Record<string, SemanticStageKey> = {
  ANALYSE: "ROOT_CAUSE_ANALYSIS",
  COUNTERMEASURE: "COUNTERMEASURES",
  VERIFY_EFFECT: "EFFECTIVENESS_CHECK",
  SUSTAINMENT: "SUSTAINMENT",
  SUSTAIN: "SUSTAINMENT",
  CONTAIN: "CURRENT_CONDITION",
};

/**
 * Default method stage for a proposal type when `semantic_stage_key` was not stored
 * (older rows). Matches guided-flow stage tooling and keeps tabs from hiding legacy data.
 */
const PROPOSAL_TYPE_DEFAULT_STAGE: Partial<
  Record<AiProposalType, SemanticStageKey>
> = {
  problem_statement: "DEFINE",
  target_condition: "TARGET_CONDITION",
  current_condition_item: "CURRENT_CONDITION",
  containment: "CURRENT_CONDITION",
  hypothesis: "ROOT_CAUSE_ANALYSIS",
  hypothesis_test: "ROOT_CAUSE_ANALYSIS",
  five_why_chain: "ROOT_CAUSE_ANALYSIS",
  fishbone_cause: "ROOT_CAUSE_ANALYSIS",
  countermeasure: "COUNTERMEASURES",
  universal_action: "IMPLEMENTATION",
  effectiveness_check: "EFFECTIVENESS_CHECK",
  sustainment_item: "SUSTAINMENT",
  lessons_learned: "SUSTAINMENT",
};

export function resolveProblemSolvingSemanticStageKey(
  key: string | null | undefined,
): SemanticStageKey | null {
  if (key == null) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  const mapped = SEMANTIC_STAGE_ALIASES[trimmed] ?? trimmed;
  if ((SEMANTIC_STAGE_KEYS as readonly string[]).includes(mapped)) {
    return mapped as SemanticStageKey;
  }
  return null;
}

function effectiveProposalStage(
  proposalType: string,
  semanticStageKey: string | null,
): SemanticStageKey | null {
  const trimmed =
    semanticStageKey != null && semanticStageKey.trim() !== ""
      ? semanticStageKey.trim()
      : null;
  if (trimmed) {
    return resolveProblemSolvingSemanticStageKey(trimmed);
  }
  const fromType = PROPOSAL_TYPE_DEFAULT_STAGE[proposalType as AiProposalType];
  return fromType ?? null;
}

/**
 * Whether a pending proposal should appear on the given guided stage tab.
 */
export function pendingAiProposalMatchesViewStage(input: {
  proposal_type: string;
  semantic_stage_key: string | null;
  viewStageKey: string | null | undefined;
}): boolean {
  const viewResolved = resolveProblemSolvingSemanticStageKey(
    input.viewStageKey ?? null,
  );
  if (!viewResolved) return true;

  const proposalStage = effectiveProposalStage(
    input.proposal_type,
    input.semantic_stage_key,
  );
  if (!proposalStage) {
    return true;
  }

  return proposalStage === viewResolved;
}
