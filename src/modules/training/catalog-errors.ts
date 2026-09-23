import { classifySupabaseError } from "@/platform/supabase/error-classification";

const CATALOGUE_MANAGE_DENIED =
  "You are not authorised to manage the training catalogue.";

const forbiddenPatterns = [
  /postgres/i,
  /supabase/i,
  /rpc/i,
  /p0002/i,
  /42501/i,
  /23505/i,
  /23514/i,
  /22023/i,
  /55000/i,
  /uuid/i,
  /\{.*\}/,
];

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  return error instanceof Error ? error.message : "";
}

export function trainingCatalogManageDeniedMessage() {
  return CATALOGUE_MANAGE_DENIED;
}

export function toTrainingCatalogErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const raw = readErrorMessage(error);
  const normalised = raw.toLowerCase();
  const classified = classifySupabaseError(error);

  if (
    classified === "authorization_denial" ||
    normalised.includes("training course creation is not authorised") ||
    normalised.includes("training course update is not authorised") ||
    normalised.includes("training course publish is not authorised")
  ) {
    return CATALOGUE_MANAGE_DENIED;
  }

  if (
    normalised.includes("duplicate key") &&
    normalised.includes("training_courses_organisation_id_code_key")
  ) {
    return "A course with this code already exists. Choose a different name or custom code.";
  }

  if (normalised.includes("draft course version already exists")) {
    return "A draft version already exists for this course. Edit the current draft instead of creating another.";
  }

  if (normalised.includes("published course version not found")) {
    return "Create a published version before starting a successor draft.";
  }

  if (
    classified === "not_found" ||
    normalised.includes("draft course version not found")
  ) {
    return "That draft is no longer editable. Reload the course and try again.";
  }

  if (normalised.includes("training_courses_name_check")) {
    return "Enter a course name between 1 and 160 characters.";
  }

  if (normalised.includes("training_courses_code_check")) {
    return "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number.";
  }

  if (
    normalised.includes("training_course_versions_duration_check") ||
    normalised.includes("training_course_versions_validity_check")
  ) {
    return "Duration and validity must be blank or a positive whole number.";
  }

  if (normalised.includes("training_course_versions_delivery_method_check")) {
    return "Choose a supported delivery method.";
  }

  if (classified === "infrastructure") {
    return fallback;
  }

  if (!raw || forbiddenPatterns.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  return raw;
}
