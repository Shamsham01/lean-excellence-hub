export const SKILL_VALIDATION_METHODS = [
  "manager_assessment",
  "practical_observation",
  "qualification",
  "trainer_sign_off",
  "external_certification",
] as const;

export type SkillValidationMethod = (typeof SKILL_VALIDATION_METHODS)[number];

export const SKILL_VALIDATION_METHOD_LABELS: Record<
  SkillValidationMethod,
  string
> = {
  manager_assessment: "Manager assessment",
  practical_observation: "Practical observation",
  qualification: "Qualification",
  trainer_sign_off: "Trainer sign-off",
  external_certification: "External certification",
};

export function isSkillValidationMethod(
  value: string | undefined | null,
): value is SkillValidationMethod {
  if (!value) return false;
  return (SKILL_VALIDATION_METHODS as readonly string[]).includes(value);
}
