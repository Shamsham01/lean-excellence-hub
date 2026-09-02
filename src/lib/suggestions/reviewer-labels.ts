export type ReviewerAssignmentKind =
  "claimed" | "assigned" | "reassigned" | null;

export function formatReviewerAssignmentLabel(input: {
  assignmentKind: ReviewerAssignmentKind;
  displayName: string | null;
  isActiveReviewer: boolean;
  isSelf: boolean;
}): string {
  const { assignmentKind, displayName, isActiveReviewer, isSelf } = input;

  if (!displayName && !isActiveReviewer) {
    return "Unassigned";
  }

  if (isSelf) {
    switch (assignmentKind) {
      case "claimed":
        return "Claimed by you";
      case "assigned":
        return "Assigned to you";
      case "reassigned":
        return "Reassigned to you";
      default:
        return "Assigned to you";
    }
  }

  if (displayName) {
    switch (assignmentKind) {
      case "claimed":
        return `Claimed by ${displayName}`;
      case "assigned":
        return `Assigned to ${displayName}`;
      case "reassigned":
        return `Reassigned to ${displayName}`;
      default:
        return displayName;
    }
  }

  return "Unassigned";
}

export function formatPortfolioReviewerLabel(item: {
  active_reviewer_display_name: string | null;
  active_reviewer_assignment_kind: string | null;
  is_active_reviewer: boolean;
  can_review: boolean;
  can_manage_review: boolean;
}): string | null {
  const canSeeWorkflow =
    item.can_review || item.can_manage_review || item.is_active_reviewer;

  if (!canSeeWorkflow) {
    return null;
  }

  if (item.active_reviewer_display_name) {
    return formatReviewerAssignmentLabel({
      assignmentKind:
        item.active_reviewer_assignment_kind as ReviewerAssignmentKind,
      displayName: item.active_reviewer_display_name,
      isActiveReviewer: item.is_active_reviewer,
      isSelf: item.is_active_reviewer,
    });
  }

  return "Unassigned";
}
