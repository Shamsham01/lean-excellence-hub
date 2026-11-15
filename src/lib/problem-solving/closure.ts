import type {
  ProblemSolvingCountermeasure,
  ProblemSolvingEffectivenessCheck,
} from "@/lib/problem-solving/types";

export const CLOSURE_OUTCOMES = [
  "resolved_verified_cause",
  "resolved_without_verified_cause",
  "transferred",
] as const;

export type ClosureOutcome = (typeof CLOSURE_OUTCOMES)[number];

const CORRECTIVE_COUNTERMEASURE_STATUSES = new Set([
  "selected",
  "implementing",
  "implemented",
  "effective",
]);

export const RESOLVED_CLOSURE_EFFECTIVENESS_BLOCK_REASON =
  "All effectiveness checks must pass before closing as resolved when corrective countermeasures are in place.";

export const RESOLVED_VERIFIED_CAUSE_NO_COUNTERMEASURE_NOTE =
  "Resolved (verified cause) with no corrective countermeasure does not require an effectiveness check.";

const CLOSURE_LABELS: Record<ClosureOutcome, string> = {
  resolved_verified_cause: "Resolved (verified cause)",
  resolved_without_verified_cause: "Resolved (unverified cause)",
  transferred: "Transferred",
};

export function closureOutcomeLabel(outcome: string | null): string {
  if (!outcome) return "—";
  return CLOSURE_LABELS[outcome as ClosureOutcome] ?? outcome;
}

export function hasCorrectiveCountermeasuresForClosure(
  countermeasures: Pick<ProblemSolvingCountermeasure, "status">[],
): boolean {
  return countermeasures.some((cm) =>
    CORRECTIVE_COUNTERMEASURE_STATUSES.has(cm.status),
  );
}

export function resolvedClosureBlockedByEffectiveness(
  effectivenessChecks: Pick<ProblemSolvingEffectivenessCheck, "result">[],
  hasCorrectiveCountermeasures: boolean,
): boolean {
  if (!hasCorrectiveCountermeasures) {
    return false;
  }
  return effectivenessChecks.some(
    (check) =>
      check.result === null ||
      check.result === "fail" ||
      check.result === "inconclusive",
  );
}

export function isResolvedClosureOutcome(outcome: string): boolean {
  return (
    outcome === "resolved_verified_cause" ||
    outcome === "resolved_without_verified_cause"
  );
}
