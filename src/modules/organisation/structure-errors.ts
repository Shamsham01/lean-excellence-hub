export function friendlyRpcError(
  error: { code?: string; message?: string },
  fallback: string,
) {
  if (error.code === "42501") {
    return "You are not authorised to perform this action.";
  }
  if (error.code === "23505") {
    return "A unit with this code already exists.";
  }
  if (error.code === "23514" && error.message) {
    return error.message;
  }
  if (error.code === "23514") {
    return "This change is not permitted. Check the unit state and try again.";
  }
  return fallback;
}
