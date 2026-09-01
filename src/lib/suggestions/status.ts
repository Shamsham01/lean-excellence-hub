export const SUGGESTION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "implementing",
  "implemented",
  "rejected",
  "withdrawn",
] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  accepted: "Accepted",
  implementing: "Implementing",
  implemented: "Implemented",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_BADGE_VARIANTS: Record<
  SuggestionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  submitted: "outline",
  under_review: "outline",
  accepted: "default",
  implementing: "default",
  implemented: "default",
  rejected: "destructive",
  withdrawn: "secondary",
};

export function suggestionStatusLabel(status: string): string {
  return (
    STATUS_LABELS[status as SuggestionStatus] ??
    status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function suggestionStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  return STATUS_BADGE_VARIANTS[status as SuggestionStatus] ?? "secondary";
}

export function pipelineStatuses(): SuggestionStatus[] {
  return [
    "submitted",
    "under_review",
    "accepted",
    "implementing",
    "implemented",
  ];
}

export function portfolioFilterStatuses(): SuggestionStatus[] {
  return [
    "draft",
    "submitted",
    "under_review",
    "accepted",
    "implementing",
    "implemented",
    "rejected",
    "withdrawn",
  ];
}

export function formatSuggestionReference(
  suggestionNumber: string | null,
  status: string,
): string {
  if (suggestionNumber) {
    return suggestionNumber;
  }

  return status === "draft" ? "Draft" : "Pending reference";
}
