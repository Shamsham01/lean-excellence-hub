type SupabaseLikeError = {
  message?: string;
  code?: string;
};

export function mapScheduleMutationError(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as SupabaseLikeError).message)
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";

  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as SupabaseLikeError).code)
      : "";

  if (
    code === "PGRST202" ||
    /PGRST202|schema cache|Could not find the function/i.test(raw)
  ) {
    return "This schedule could not be saved. Refresh the page and try again.";
  }

  if (code === "42501" || /42501/.test(raw)) {
    return "You do not have permission to change this schedule.";
  }

  if (code === "55000" || /55000/.test(raw)) {
    if (/not active/i.test(raw)) {
      return "Only an active schedule can be edited. Reactivate it first.";
    }
    if (/not inactive/i.test(raw)) {
      return "Only an inactive schedule can be reactivated.";
    }
    return "This schedule could not be updated in its current state.";
  }

  if (code === "22023" || /22023/.test(raw)) {
    if (/not applicable/i.test(raw)) {
      return "That unit is not applicable to this scheduled activity.";
    }
    if (/recurrence is invalid/i.test(raw)) {
      return "Check the recurrence details and try again.";
    }
    if (/all-day schedules cannot include local time/i.test(raw)) {
      return "All-day schedules cannot include a local time.";
    }
    if (/timed schedules require local time/i.test(raw)) {
      return "Timed schedules require a local time.";
    }
    return "Please check the schedule details and try again.";
  }

  if (code === "23514" || /end_date|start_date/i.test(raw)) {
    return "End date must be on or after the start date.";
  }

  if (code === "23503" || /23503/.test(raw)) {
    if (/owner membership/i.test(raw)) {
      return "Choose a valid owner.";
    }
    if (/participant membership/i.test(raw)) {
      return "One or more participants are no longer available.";
    }
    return "A related record for this schedule is no longer available.";
  }

  if (!raw) {
    return "This schedule could not be updated.";
  }

  const forbidden = [
    /postgres/i,
    /supabase/i,
    /rpc/i,
    /uuid/i,
    /\{.*\}/,
    /PGRST/i,
    /P0002/i,
    /42501/i,
    /55000/i,
    /22023/i,
    /23503/i,
    /23514/i,
  ];

  if (forbidden.some((pattern) => pattern.test(raw))) {
    return "This schedule could not be updated.";
  }

  return raw;
}
