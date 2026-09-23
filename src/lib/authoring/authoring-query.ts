export const AUTHORING_STEP_PARAM = "step";
export const AUTHORING_SAVED_PARAM = "saved";

export type AuthoringSavedKey =
  "applicability" | "section" | "question" | "publish" | "framework" | "course";

const AUTHORING_SAVED_KEYS = new Set<AuthoringSavedKey>([
  "applicability",
  "section",
  "question",
  "publish",
  "framework",
  "course",
]);

export function parseAuthoringStep<T extends string>(
  value: string | null | undefined,
  validSteps: readonly T[],
  fallback: T,
): T {
  if (!value?.trim()) {
    return fallback;
  }
  return validSteps.includes(value as T) ? (value as T) : fallback;
}

export function buildAuthoringStepSearch(
  step: string,
  defaultStep: string,
  existingSearch = "",
): string {
  const params = new URLSearchParams(
    existingSearch.startsWith("?") ? existingSearch.slice(1) : existingSearch,
  );
  if (step === defaultStep) {
    params.delete(AUTHORING_STEP_PARAM);
  } else {
    params.set(AUTHORING_STEP_PARAM, step);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function parseAuthoringSavedKey(
  value: string | null | undefined,
): AuthoringSavedKey | null {
  if (!value?.trim()) {
    return null;
  }
  return AUTHORING_SAVED_KEYS.has(value as AuthoringSavedKey)
    ? (value as AuthoringSavedKey)
    : null;
}

export function authoringSaveMessage(key: AuthoringSavedKey): string {
  switch (key) {
    case "applicability":
      return "Applicable areas saved.";
    case "section":
      return "Category saved.";
    case "question":
      return "Question saved.";
    case "publish":
      return "Published successfully.";
    case "framework":
      return "Saved.";
    case "course":
      return "Course details saved.";
  }
}

export function buildAuthoringSavedRedirectPath(
  path: string,
  saved: AuthoringSavedKey,
  existingSearch = "",
): string {
  const params = new URLSearchParams(
    existingSearch.startsWith("?") ? existingSearch.slice(1) : existingSearch,
  );
  params.set(AUTHORING_SAVED_PARAM, saved);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
