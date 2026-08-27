export const CLOSURE_OUTCOMES = [
  "resolved_verified_cause",
  "resolved_without_verified_cause",
  "transferred",
] as const;

export type ClosureOutcome = (typeof CLOSURE_OUTCOMES)[number];

const CLOSURE_LABELS: Record<ClosureOutcome, string> = {
  resolved_verified_cause: "Resolved (verified cause)",
  resolved_without_verified_cause: "Resolved (unverified cause)",
  transferred: "Transferred",
};

export function closureOutcomeLabel(outcome: string | null): string {
  if (!outcome) return "—";
  return CLOSURE_LABELS[outcome as ClosureOutcome] ?? outcome;
}
