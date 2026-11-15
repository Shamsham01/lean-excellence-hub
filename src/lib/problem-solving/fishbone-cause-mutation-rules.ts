export const FISHBONE_CAUSE_LABEL_MAX_LENGTH = 500;

export const PROMOTED_FISHBONE_CAUSE_LOCKED_MESSAGE =
  "Promoted, edit the hypothesis instead.";

export const CLOSED_CASE_FISHBONE_MUTATION_MESSAGE =
  "This case is closed; fishbone causes cannot be changed.";

export function validatePromotedFishboneCauseMutable(
  linkedHypothesisId: string | null,
): { ok: true } | { error: string } {
  if (linkedHypothesisId) {
    return { error: PROMOTED_FISHBONE_CAUSE_LOCKED_MESSAGE };
  }
  return { ok: true };
}
