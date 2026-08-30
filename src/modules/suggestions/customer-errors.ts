const forbiddenPatterns = [
  /postgres/i,
  /supabase/i,
  /rpc/i,
  /p0002/i,
  /42501/i,
  /23514/i,
  /22023/i,
  /55000/i,
  /uuid/i,
  /\{.*\}/,
];

export function toSuggestionCatalogErrorMessage(
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

  const normalised = raw.toLowerCase();

  if (normalised.includes("category is referenced by suggestions")) {
    return "This category has already been used by suggestions and cannot be deleted. Deactivate it instead to prevent future use.";
  }

  if (forbiddenPatterns.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  return raw;
}
