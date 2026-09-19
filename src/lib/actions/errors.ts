type SupabaseLikeError = {
  message?: string;
  code?: string;
};

export function mapActionMutationError(error: unknown): string {
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
    if (/transition is not allowed/i.test(raw)) {
      return "That status change is not allowed from the current state.";
    }
    if (/cannot be edited/i.test(raw) || /cannot be reassigned/i.test(raw)) {
      return "This action is closed and can no longer be edited.";
    }
    if (/changed since you opened/i.test(raw)) {
      return "This action changed since you opened it. Refreshing the latest state.";
    }
    return "This action could not be updated in its current state.";
  }

  if (code === "42501" || /42501/.test(raw)) {
    return "You do not have permission to change this action.";
  }

  if (code === "P0002" || /P0002/i.test(raw)) {
    return "This action is no longer available.";
  }

  if (code === "22023" || /22023/.test(raw)) {
    if (/priority/i.test(raw)) {
      return "Choose a valid priority.";
    }
    if (/assignee/i.test(raw)) {
      return "That person is not available to assign.";
    }
    if (/status/i.test(raw)) {
      return "Choose a valid status.";
    }
    return "Please check the action details and try again.";
  }

  if (!raw) {
    return "This action could not be updated.";
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
    return "This action could not be updated.";
  }

  return raw;
}
