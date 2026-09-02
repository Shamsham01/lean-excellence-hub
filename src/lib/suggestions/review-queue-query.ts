export type SuggestionReviewQueueMode = "mine" | "unassigned";

export type SuggestionReviewQueueSearchParams = {
  queue: SuggestionReviewQueueMode;
  suggestionId: string | null;
  page: number;
};

export type RawReviewQueueSearchParams = Record<
  string,
  string | string[] | undefined
>;

function readParam(
  params: RawReviewQueueSearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeQueueMode(
  value: string | null | undefined,
): SuggestionReviewQueueMode {
  return value === "unassigned" ? "unassigned" : "mine";
}

function normalizePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeUuid(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
    ? value.trim()
    : null;
}

export function parseSuggestionReviewQueueSearchParams(
  params: RawReviewQueueSearchParams,
): SuggestionReviewQueueSearchParams {
  return {
    queue: normalizeQueueMode(readParam(params, "queue")),
    suggestionId: normalizeUuid(readParam(params, "suggestionId")),
    page: normalizePage(readParam(params, "page")),
  };
}

export function buildSuggestionReviewQueueSearchParams(
  state: Partial<SuggestionReviewQueueSearchParams>,
): URLSearchParams {
  const params = new URLSearchParams();
  const queue = state.queue ?? "mine";

  if (queue === "unassigned") {
    params.set("queue", "unassigned");
  }

  if (state.suggestionId) {
    params.set("suggestionId", state.suggestionId);
  }

  if (state.page && state.page > 1) {
    params.set("page", String(state.page));
  }

  return params;
}

export function suggestionReviewQueueHref(
  state: Partial<SuggestionReviewQueueSearchParams>,
): string {
  const query = buildSuggestionReviewQueueSearchParams(state).toString();
  return query
    ? `/platform/suggestions/review?${query}`
    : "/platform/suggestions/review";
}
