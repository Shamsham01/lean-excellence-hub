import { classifySupabaseError } from "@/platform/supabase/error-classification";

const CURRICULUM_MANAGE_DENIED =
  "You are not authorised to manage training curricula.";

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

export function trainingCurriculumManageDeniedMessage() {
  return CURRICULUM_MANAGE_DENIED;
}

export function toTrainingCurriculumErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const raw = readErrorMessage(error);
  const normalised = raw.toLowerCase();
  const classified = classifySupabaseError(error);

  if (
    classified === "authorization_denial" ||
    normalised.includes("training curriculum creation is not authorised") ||
    normalised.includes("training curriculum publish is not authorised") ||
    normalised.includes(
      "training curriculum successor creation is not authorised",
    ) ||
    normalised.includes("training requirement creation is not authorised") ||
    normalised.includes("training requirement update is not authorised") ||
    normalised.includes("training requirement removal is not authorised")
  ) {
    return CURRICULUM_MANAGE_DENIED;
  }

  if (
    normalised.includes("duplicate key") &&
    normalised.includes("training_curricula_organisation_id_code_key")
  ) {
    return "A curriculum with this code already exists. Choose a different name or custom code.";
  }

  if (normalised.includes("draft curriculum version already exists")) {
    return "A draft version already exists for this curriculum. Edit the current draft instead of creating another.";
  }

  if (normalised.includes("published curriculum version not found")) {
    return "Publish a curriculum version before starting a successor draft.";
  }

  if (
    classified === "not_found" ||
    normalised.includes("draft curriculum version not found") ||
    normalised.includes("training requirement not found")
  ) {
    return "That draft is no longer editable. Reload the curriculum and try again.";
  }

  if (normalised.includes("training course not found")) {
    return "Choose a course from this organisation.";
  }

  if (normalised.includes("job function not found")) {
    return "Choose a job function from this organisation.";
  }

  if (normalised.includes("organisational unit not found")) {
    return "Choose an organisational unit from this organisation.";
  }

  if (normalised.includes("training_curricula_name_check")) {
    return "Enter a curriculum name between 1 and 160 characters.";
  }

  if (normalised.includes("training_curricula_code_check")) {
    return "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number.";
  }

  if (normalised.includes("training_requirements_target_check")) {
    return "A requirement must apply to everyone or to a job function.";
  }

  if (
    normalised.includes("training_requirements_required_within_check") ||
    normalised.includes("training_requirements_validity_override_check")
  ) {
    return "Completion deadline and validity override must be blank or a positive whole number.";
  }

  if (normalised.includes("training_requirements_grace_period_check")) {
    return "Grace period must be blank or zero or a positive whole number.";
  }

  if (classified === "infrastructure") {
    return fallback;
  }

  if (!raw || forbiddenPatterns.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  return raw;
}
