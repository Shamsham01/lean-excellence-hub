export type TrainingValidityState = "valid" | "expiring" | "expired" | "none";

export type TrainingRequirementPresentationStatus =
  | "not_required"
  | "required"
  | "completed"
  | "due"
  | "expiring"
  | "expired"
  | "waived";

export function deriveTrainingValidityDays(
  validityDaysOverride: number | null | undefined,
  courseVersionValidityDays: number | null | undefined,
): number | null {
  if (validityDaysOverride != null) return validityDaysOverride;
  if (courseVersionValidityDays != null) return courseVersionValidityDays;
  return null;
}

export function deriveTrainingCompletionValidityState(
  status: string,
  expiresAt: string | null | undefined,
  asOf = new Date(),
  expiringWindowDays = 30,
): TrainingValidityState {
  if (status !== "completed") return "none";
  if (!expiresAt) return "valid";

  const expires = new Date(expiresAt);
  if (asOf >= expires) return "expired";

  const windowStart = new Date(expires);
  windowStart.setDate(windowStart.getDate() - expiringWindowDays);
  if (asOf >= windowStart) return "expiring";

  return "valid";
}

export function trainingValidityLabel(state: TrainingValidityState): string {
  switch (state) {
    case "valid":
      return "Valid";
    case "expiring":
      return "Expiring";
    case "expired":
      return "Expired";
    default:
      return "Not applicable";
  }
}

export function trainingMatrixCellLabel(
  isRequired: boolean,
  isSatisfied: boolean,
  validityState: TrainingValidityState,
): string {
  if (!isRequired) return "Not Required";
  if (isSatisfied && validityState === "valid") return "Completed";
  if (isSatisfied && validityState === "expiring") return "Expiring";
  if (validityState === "expired") return "Expired";
  return "Required";
}
