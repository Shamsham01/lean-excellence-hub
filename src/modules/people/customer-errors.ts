const forbiddenPatterns = [
  /role version/i,
  /delegation picker/i,
  /provisioning tools/i,
  /membership profile administration/i,
  /not yet available/i,
  /postgres/i,
  /supabase/i,
  /rpc/i,
  /p0002/i,
  /42501/i,
  /23514/i,
  /22023/i,
  /uuid/i,
  /\{.*\}/,
];

export function toCustomerErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: string }).message)
      : "";

  if (!raw) {
    return fallback;
  }

  if (forbiddenPatterns.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  const normalised = raw.toLowerCase();

  if (normalised.includes("author has no primary organisational unit")) {
    return "Your organisation assignment is incomplete. Ask an administrator to assign your primary work area before submitting an idea.";
  }

  if (normalised.includes("invitation issue is not authorised")) {
    return "You do not have permission to send invitations with the selected access.";
  }

  if (normalised.includes("invitation authority is not contained")) {
    return "The selected application role or scope is outside your authority to delegate.";
  }

  if (normalised.includes("job function assignment is not authorised")) {
    return "You do not have permission to assign job functions.";
  }

  if (normalised.includes("membership update is not authorised")) {
    return "You do not have permission to update this person's details.";
  }

  if (normalised.includes("display name is invalid")) {
    return "Enter a display name between 1 and 120 characters.";
  }

  if (normalised.includes("workforce alias is unavailable")) {
    return "That username is already in use or reserved. Choose a different username.";
  }

  if (normalised.includes("workforce provisioning is not authorised")) {
    return "You do not have permission to create workforce users with the selected access.";
  }

  if (
    normalised.includes("workforce provisioning authority is not contained")
  ) {
    return "The selected application role or scope is outside your authority to delegate.";
  }

  return fallback;
}
