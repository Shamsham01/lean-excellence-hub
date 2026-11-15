import type { MethodStage } from "@/lib/problem-solving/stages";
import type {
  ProblemSolvingActionSummary,
  ProblemSolvingCaseDetail,
  ProblemSolvingEffectivenessCheck,
  ProblemSolvingHypothesis,
} from "@/lib/problem-solving/types";

const STAGE_PROGRESSION = [
  "DEFINE",
  "CURRENT_CONDITION",
  "TARGET_CONDITION",
  "ROOT_CAUSE_ANALYSIS",
  "ANALYSE",
  "COUNTERMEASURES",
  "COUNTERMEASURE",
  "IMPLEMENTATION",
  "EFFECTIVENESS_CHECK",
  "VERIFY_EFFECT",
  "SUSTAINMENT",
  "SUSTAIN",
] as const;

export const PREMATURE_COUNTERMEASURES_NOTICE =
  "Countermeasures started before a cause was verified.";

export type CaseProgressDerivation = {
  stage: MethodStage | null;
  prematureCountermeasuresNotice: boolean;
};

const STAGE_RANK_ALIASES: Record<string, string> = {
  ANALYSE: "ROOT_CAUSE_ANALYSIS",
  VERIFY_EFFECT: "EFFECTIVENESS_CHECK",
  COUNTERMEASURE: "COUNTERMEASURES",
  SUSTAIN: "SUSTAINMENT",
};

function stageRank(semanticKey: string | null | undefined): number {
  if (!semanticKey) return 0;
  const normalized = STAGE_RANK_ALIASES[semanticKey] ?? semanticKey;
  const index = STAGE_PROGRESSION.indexOf(
    normalized as (typeof STAGE_PROGRESSION)[number],
  );
  if (index >= 0) return index;
  return 0;
}

export function hasVerifiedRootCause(
  hypotheses: ProblemSolvingHypothesis[] | undefined,
): boolean {
  return (hypotheses ?? []).some((row) => row.status === "verified");
}

function hasCountermeasureActions(
  actions: ProblemSolvingActionSummary[] | undefined,
): boolean {
  return (actions ?? []).some((row) => row.context_role === "countermeasure");
}

function hasPassingEffectivenessCheck(
  checks: ProblemSolvingEffectivenessCheck[] | undefined,
): boolean {
  return (checks ?? []).some((row) => row.result === "pass");
}

function isTerminalCaseStatusForDerive(status: string): boolean {
  return status === "closed" || status === "cancelled";
}

function resolveStageForImpliedKey(
  methodStages: MethodStage[],
  impliedKey: string,
  pinned: MethodStage | null,
): MethodStage | null {
  const impliedRank = stageRank(impliedKey);

  const exact = methodStages.find(
    (row) => row.semantic_stage_key === impliedKey,
  );
  if (exact) {
    return exact;
  }

  let bestAtOrBelow: MethodStage | null = null;
  let bestRank = -1;
  for (const row of methodStages) {
    const rank = stageRank(row.semantic_stage_key);
    if (rank <= impliedRank && rank > bestRank) {
      bestAtOrBelow = row;
      bestRank = rank;
    }
  }
  if (bestAtOrBelow) {
    return bestAtOrBelow;
  }

  return pinned ?? methodStages[0] ?? null;
}

/**
 * Furthest method stage implied by case content gates (not mere record presence
 * where Kaizen rules apply) — used for header display when
 * {@link ProblemSolvingCaseDetail.current_method_stage_id} was never advanced.
 */
export function deriveCaseProgressStage(
  methodStages: MethodStage[],
  detail: Pick<
    ProblemSolvingCaseDetail,
    | "problem_statement"
    | "target_condition"
    | "hypotheses"
    | "countermeasures"
    | "actions"
    | "effectiveness_checks"
    | "sustainment_items"
    | "status"
    | "current_stage"
  >,
  currentConditionItemCount: number,
  analysisNodeCount: number,
): CaseProgressDerivation {
  if (methodStages.length === 0) {
    return { stage: null, prematureCountermeasuresNotice: false };
  }
  if (isTerminalCaseStatusForDerive(detail.status)) {
    return { stage: null, prematureCountermeasuresNotice: false };
  }

  let impliedKey: string = "DEFINE";
  if (
    (detail.problem_statement?.trim().length ?? 0) > 0 ||
    currentConditionItemCount > 0
  ) {
    impliedKey = "CURRENT_CONDITION";
  }
  if ((detail.target_condition?.trim().length ?? 0) > 0) {
    impliedKey = "TARGET_CONDITION";
  }
  if (analysisNodeCount > 0 || (detail.hypotheses?.length ?? 0) > 0) {
    impliedKey = "ROOT_CAUSE_ANALYSIS";
  }

  const verifiedCause = hasVerifiedRootCause(detail.hypotheses);
  const hasCountermeasures = (detail.countermeasures?.length ?? 0) > 0;
  const prematureCountermeasuresNotice = hasCountermeasures && !verifiedCause;

  if (hasCountermeasures && verifiedCause) {
    impliedKey = "COUNTERMEASURES";
  }

  if (verifiedCause && hasCountermeasureActions(detail.actions)) {
    impliedKey = "IMPLEMENTATION";
  }

  if ((detail.effectiveness_checks?.length ?? 0) > 0) {
    impliedKey = "EFFECTIVENESS_CHECK";
  }

  if (
    hasPassingEffectivenessCheck(detail.effectiveness_checks) &&
    (detail.sustainment_items?.length ?? 0) > 0
  ) {
    impliedKey = "SUSTAINMENT";
  }

  if (
    !verifiedCause &&
    stageRank(impliedKey) > stageRank("ROOT_CAUSE_ANALYSIS")
  ) {
    impliedKey = "ROOT_CAUSE_ANALYSIS";
  }

  const pinned =
    detail.current_stage?.id != null
      ? (methodStages.find((row) => row.id === detail.current_stage?.id) ??
        null)
      : null;

  const pinnedAllowed =
    pinned &&
    (!prematureCountermeasuresNotice ||
      stageRank(pinned.semantic_stage_key) <= stageRank("ROOT_CAUSE_ANALYSIS"));

  let stage: MethodStage | null;
  if (
    pinnedAllowed &&
    pinned &&
    stageRank(pinned.semantic_stage_key) >= stageRank(impliedKey)
  ) {
    stage = pinned;
  } else {
    stage = resolveStageForImpliedKey(methodStages, impliedKey, pinned);
  }

  return { stage, prematureCountermeasuresNotice };
}

export function resolveDisplayedCurrentStage(
  methodStages: MethodStage[],
  detail: ProblemSolvingCaseDetail,
  currentConditionItemCount: number,
  analysisNodeCount: number,
): CaseProgressDerivation {
  if (isTerminalCaseStatusForDerive(detail.status)) {
    return { stage: null, prematureCountermeasuresNotice: false };
  }
  const derived = deriveCaseProgressStage(
    methodStages,
    detail,
    currentConditionItemCount,
    analysisNodeCount,
  );
  if (derived.stage) return derived;
  if (detail.current_stage?.id) {
    return {
      stage:
        methodStages.find((row) => row.id === detail.current_stage?.id) ?? null,
      prematureCountermeasuresNotice: derived.prematureCountermeasuresNotice,
    };
  }
  return {
    stage: methodStages[0] ?? null,
    prematureCountermeasuresNotice: derived.prematureCountermeasuresNotice,
  };
}
