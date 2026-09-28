export const FORMAL_LIFECYCLE_STEPS = [
  { id: "in_progress", label: "Assessment" },
  { id: "submitted", label: "Submitted" },
  { id: "assessor_review", label: "Assessor review" },
  { id: "approved", label: "Approved" },
  { id: "published", label: "Published" },
] as const;

export type FormalLifecycleStatus =
  (typeof FORMAL_LIFECYCLE_STEPS)[number]["id"];

export function formalLifecycleIndex(status: string): number {
  const index = FORMAL_LIFECYCLE_STEPS.findIndex((step) => step.id === status);
  return index < 0 ? 0 : index;
}

export function canEditMaturityAssessment(input: {
  status: string;
  canReview: boolean;
}): boolean {
  if (input.status === "draft" || input.status === "in_progress") {
    return true;
  }
  return input.status === "assessor_review" && input.canReview;
}
