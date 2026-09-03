type SupabaseLikeError = {
  message?: string;
  code?: string;
};

export function mapSuggestionReviewActionError(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as SupabaseLikeError).message)
      : error instanceof Error
        ? error.message
        : "";

  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as SupabaseLikeError).code)
      : "";

  if (code === "55000" || /55000/.test(raw)) {
    return "This suggestion changed since you opened it. Refreshing the latest state.";
  }

  if (code === "42501" || /42501/.test(raw)) {
    return "You no longer have permission to perform this review action.";
  }

  if (code === "P0002" || /P0002/i.test(raw)) {
    return "This suggestion is no longer available.";
  }

  if (code === "22023" || /22023/.test(raw)) {
    if (/rationale/i.test(raw)) {
      return "A rationale is required for this action.";
    }
    return "Please check the review details and try again.";
  }

  if (!raw) {
    return "This review action could not be completed.";
  }

  const forbidden = [
    /postgres/i,
    /supabase/i,
    /rpc/i,
    /uuid/i,
    /\{.*\}/,
    /P0002/i,
    /42501/i,
    /55000/i,
    /22023/i,
  ];

  if (forbidden.some((pattern) => pattern.test(raw))) {
    return "This review action could not be completed.";
  }

  return raw;
}
