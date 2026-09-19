type SupabaseLikeError = {
  message?: string;
  code?: string;
};

export function mapProjectMutationError(error: unknown): string {
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
    if (/not submittable/i.test(raw)) {
      return "This project cannot be submitted in its current status.";
    }
    if (/only draft projects can be edited/i.test(raw)) {
      return "Only draft projects can be edited.";
    }
    if (/team changes are not allowed/i.test(raw)) {
      return "Team changes are not allowed in the current project status.";
    }
    if (/metrics cannot be added/i.test(raw)) {
      return "Measures cannot be added in the current project status.";
    }
    return "This project could not be updated in its current state.";
  }

  if (code === "42501" || /42501/.test(raw)) {
    return "You do not have permission to change this project.";
  }

  if (code === "P0002" || /P0002/i.test(raw)) {
    return "This project is no longer available.";
  }

  if (code === "22023" || /22023/.test(raw)) {
    if (/project charter is incomplete/i.test(raw)) {
      const listed = raw.match(/project charter is incomplete:\s*(.+)$/i)?.[1];
      return listed
        ? `Charter is incomplete: ${listed}.`
        : "Charter is incomplete. Add the required title, problem statement, objective, and methodology.";
    }
    if (/exactly one active owner/i.test(raw)) {
      return "Assign exactly one active owner before submitting the charter.";
    }
    if (/methodology version is not published/i.test(raw)) {
      return "Choose a published methodology before submitting the charter.";
    }
    if (/invalid project team role/i.test(raw)) {
      return "Choose a valid team role.";
    }
    return "Please check the project details and try again.";
  }

  if (!raw) {
    return "This project could not be updated.";
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
    return "This project could not be updated.";
  }

  return raw;
}
