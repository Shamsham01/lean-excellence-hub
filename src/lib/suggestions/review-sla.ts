export type ReviewSlaState = "on_time" | "due_soon" | "overdue" | "decided";

export function deriveReviewSlaState(
  submittedAt: string | null | undefined,
  reviewTargetDays: number | null | undefined,
  hasFinalDecision: boolean,
  now = new Date(),
): ReviewSlaState {
  if (hasFinalDecision) return "decided";
  if (!submittedAt || !reviewTargetDays) return "on_time";

  const submitted = new Date(submittedAt);
  const due = new Date(submitted);
  due.setDate(due.getDate() + reviewTargetDays);

  if (now > due) return "overdue";

  const dueSoonThreshold = new Date(due);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() - 2);
  if (now >= dueSoonThreshold) return "due_soon";

  return "on_time";
}

export function reviewSlaLabel(state: ReviewSlaState): string {
  switch (state) {
    case "on_time":
      return "On time";
    case "due_soon":
      return "Due soon";
    case "overdue":
      return "Overdue";
    case "decided":
      return "Decided";
  }
}
