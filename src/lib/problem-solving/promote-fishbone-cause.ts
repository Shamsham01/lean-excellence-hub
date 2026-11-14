export type FishboneCausePromotionInput = {
  linkedHypothesisId: string | null;
  label: string;
  category: string;
};

export function validateFishboneCausePromotion(
  input: FishboneCausePromotionInput,
): { ok: true } | { error: string } {
  if (input.linkedHypothesisId) {
    return { error: "This cause is already promoted to a hypothesis." };
  }
  if (!input.label.trim()) {
    return { error: "Cause label is required." };
  }
  if (!input.category.trim()) {
    return { error: "Fishbone category is required." };
  }
  return { ok: true };
}