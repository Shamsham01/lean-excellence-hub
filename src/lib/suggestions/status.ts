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

export function suggestionStatusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
