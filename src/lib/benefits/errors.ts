type SupabaseLikeError = {
  message?: string;
  code?: string;
};

export function mapBenefitMutationError(error: unknown): string {
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

  if (code === "42501" || /42501/.test(raw)) {
    return "You do not have permission to create or change this benefit.";
  }

  if (code === "P0002" || /P0002/i.test(raw)) {
    return "This benefit or linked project is no longer available.";
  }

  if (code === "55000" || /55000/.test(raw)) {
    return "This benefit could not be updated in its current state.";
  }

  if (code === "22023" || /22023/.test(raw)) {
    return "Please check the benefit details and try again.";
  }

  if (!raw) {
    return "This benefit could not be updated.";
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
    return "This benefit could not be updated.";
  }

  return raw;
}
