import type { ProjectorOutcome } from "../types.ts";

export const SUGGESTION_REVIEW_STARTED_EVENT = "SuggestionReviewStarted";

export function projectSuggestionReviewStarted(): ProjectorOutcome {
  return { kind: "noop" };
}
