import type { MethodStage } from "@/lib/problem-solving/stages";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

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

function stageRank(semanticKey: string | null | undefined): number {
  if (!semanticKey) return 0;
  const index = STAGE_PROGRESSION.indexOf(
    semanticKey as (typeof STAGE_PROGRESSION)[number],
  );
  if (index >= 0) return index;
  return 0;
}

/**
 * Furthest method stage implied by case content — used for header display when
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
): MethodStage | null {
  if (methodStages.length === 0) return null;
  if (isTerminalCaseStatusForDerive(detail.status)) {
    return null;
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
  if (
    analysisNodeCount > 0 ||
    (detail.hypotheses?.length ?? 0) > 0
  ) {
    impliedKey = "ROOT_CAUSE_ANALYSIS";
  }
  if ((detail.countermeasures?.length ?? 0) > 0) {
    impliedKey = "COUNTERMEASURES";
  }
  if ((detail.actions?.length ?? 0) > 0) {
    impliedKey = "IMPLEMENTATION";
  }
  if ((detail.effectiveness_checks?.length ?? 0) > 0) {
    impliedKey = "EFFECTIVENESS_CHECK";
  }
  if ((detail.sustainment_items?.length ?? 0) > 0) {
    impliedKey = "SUSTAINMENT";
  }

  const pinned =
    detail.current_stage?.id != null
      ? (methodStages.find((row) => row.id === detail.current_stage?.id) ??
        null)
      : null;
  if (pinned && stageRank(pinned.semantic_stage_key) >= stageRank(impliedKey)) {
    return pinned;
  }

  const byKey =
    methodStages.find((row) => row.semantic_stage_key === impliedKey) ??
    methodStages.find(
      (row) =>
        row.semantic_stage_key === "ANALYSE" &&
        impliedKey === "ROOT_CAUSE_ANALYSIS",
    ) ??
    methodStages.find(
      (row) =>
        row.semantic_stage_key === "VERIFY_EFFECT" &&
        impliedKey === "EFFECTIVENESS_CHECK",
    );

  return byKey ?? pinned ?? methodStages[0] ?? null;
}

function isTerminalCaseStatusForDerive(status: string): boolean {
  return status === "closed" || status === "cancelled";
}

export function resolveDisplayedCurrentStage(
  methodStages: MethodStage[],
  detail: ProblemSolvingCaseDetail,
  currentConditionItemCount: number,
  analysisNodeCount: number,
): MethodStage | null {
  if (isTerminalCaseStatusForDerive(detail.status)) {
    return null;
  }
  const derived = deriveCaseProgressStage(
    methodStages,
    detail,
    currentConditionItemCount,
    analysisNodeCount,
  );
  if (derived) return derived;
  if (detail.current_stage?.id) {
    return (
      methodStages.find((row) => row.id === detail.current_stage?.id) ??
      null
    );
  }
  return methodStages[0] ?? null;
}