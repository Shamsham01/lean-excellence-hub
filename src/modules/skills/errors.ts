import { classifySupabaseError } from "@/platform/supabase/error-classification";

const forbiddenPatterns = [
  /postgres/i,
  /supabase/i,
  /rpc/i,
  /p0002/i,
  /42501/i,
  /23505/i,
  /23514/i,
  /23503/i,
  /22023/i,
  /uuid/i,
  /\{.*\}/,
];

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  return error instanceof Error ? error.message : "";
}

function readErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

export function skillsCatalogDeniedMessage() {
  return "You are not authorised to manage the skills catalogue.";
}

export function skillsRequirementsDeniedMessage() {
  return "You are not authorised to manage capability requirements.";
}

export function toSkillsAuthoringError(error: unknown, fallback: string) {
  const raw = readErrorMessage(error);
  const normalised = raw.toLowerCase();
  const code = readErrorCode(error);
  const classified = classifySupabaseError(error);

  if (
    classified === "authorization_denial" ||
    code === "42501" ||
    normalised.includes("not authorised")
  ) {
    if (
      normalised.includes("requirement") ||
      normalised.includes("capability set")
    ) {
      return skillsRequirementsDeniedMessage();
    }

    return skillsCatalogDeniedMessage();
  }

  if (normalised.includes("skill_proficiency_levels_version_order_key")) {
    return "Each level needs a unique order.";
  }

  if (
    code === "23505" ||
    normalised.includes("duplicate key") ||
    normalised.includes("skills_organisation_id_code_key") ||
    normalised.includes("skill_capability_sets_organisation_id_code_key")
  ) {
    return "That code is already in use. Choose a different code.";
  }

  if (
    classified === "not_found" ||
    code === "P0002" ||
    normalised.includes("draft scale version not found") ||
    normalised.includes("draft capability set version not found")
  ) {
    return "That draft is no longer available. Reload and try again.";
  }

  if (normalised.includes("at least two levels")) {
    return "Add at least two proficiency levels before publishing.";
  }

  if (normalised.includes("at least one requirement")) {
    return "Add at least one requirement before publishing.";
  }

  if (normalised.includes("skill is not active")) {
    return "Choose an active skill.";
  }

  if (normalised.includes("job function is not active")) {
    return "Choose an active job function.";
  }

  if (normalised.includes("organisational unit is not active")) {
    return "Choose an active organisational unit, or leave the unit unset.";
  }

  if (normalised.includes("proficiency scale version is not published")) {
    return "Choose a level from a published proficiency scale.";
  }

  if (
    normalised.includes("incompatible with scale") ||
    normalised.includes("target proficiency level")
  ) {
    return "The required level does not belong to the published proficiency scale.";
  }

  if (
    normalised.includes("skill_proficiency_scales_name_check") ||
    normalised.includes("skills_name_check") ||
    normalised.includes("skill_capability_sets_name_check")
  ) {
    return "Enter a name between 1 and 160 characters.";
  }

  if (
    normalised.includes("skills_code_check") ||
    normalised.includes("skill_capability_sets_code_check")
  ) {
    return "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number.";
  }

  if (normalised.includes("skill_proficiency_levels_label_check")) {
    return "Enter a level label between 1 and 120 characters.";
  }

  if (normalised.includes("existing proficiency scale differs")) {
    return "A proficiency scale with this name already exists and its levels differ. Nothing was changed. Choose to keep the existing scale or create a separate draft.";
  }

  if (normalised.includes("compatible proficiency scale was not found")) {
    return "No published scale matches this name and these levels. Nothing was changed.";
  }

  if (normalised.includes("job function is not in this organisation")) {
    return "Choose a job function from this organisation. Nothing was saved.";
  }

  if (normalised.includes("organisational unit is not in this organisation")) {
    return "Choose an organisational unit from this organisation. Nothing was saved.";
  }

  if (
    normalised.includes("unit applicability requires an organisational unit")
  ) {
    return "Choose at least one unit for these requirements, or apply them wherever the job function is used. Nothing was saved.";
  }

  if (normalised.includes("creation key does not match this content")) {
    return "This setup was already created from different choices. Start a new setup to keep these changes. The earlier draft was not replaced.";
  }

  if (normalised.includes("creation key is already finished")) {
    return "That setup was already published or discarded. Start a new setup. Nothing was replaced.";
  }

  if (normalised.includes("published setup bundles are kept")) {
    return "This setup is already published. Use versioning to change it. History was not deleted.";
  }

  if (normalised.includes("discarded setup bundles cannot be published")) {
    return "This draft was discarded. Start a new setup.";
  }

  if (normalised.includes("draft skills cannot be assessed")) {
    return "Publish the setup before assessing this skill. Completing training does not make someone competent.";
  }

  if (normalised.includes("module setup definition")) {
    return "Check the setup and try again. Nothing was saved or published.";
  }

  if (normalised.includes("skill setup bundle was not found")) {
    return "That setup draft could not be found.";
  }

  if (classified === "infrastructure") {
    return fallback;
  }

  if (!raw || forbiddenPatterns.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  return fallback;
}
