import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

export const proficiencyLevelInputSchema = z.object({
  order: z
    .number()
    .int("Order must be a whole number.")
    .min(0, "Order cannot be negative.")
    .max(999, "Order must be 999 or less."),
  label: z
    .string()
    .trim()
    .min(1, "Enter a label for every level.")
    .max(120, "Level labels must be 120 characters or fewer."),
  description: optionalText(
    2000,
    "Level descriptions must be 2,000 characters or fewer.",
  ),
  guidance: optionalText(
    2000,
    "Level guidance must be 2,000 characters or fewer.",
  ),
});

export const createProficiencyScaleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a scale name.")
    .max(160, "Scale name must be 160 characters or fewer."),
  description: optionalText(
    2000,
    "Description must be 2,000 characters or fewer.",
  ),
  levels: z
    .array(proficiencyLevelInputSchema)
    .max(20, "A scale can include up to 20 levels in this version.")
    .superRefine((levels, context) => {
      const orders = levels.map((level) => level.order);
      if (new Set(orders).size !== orders.length) {
        context.addIssue({
          code: "custom",
          message: "Each level needs a unique order.",
          path: ["levels"],
        });
      }
    }),
});

export const addProficiencyLevelSchema = proficiencyLevelInputSchema.extend({
  scaleVersionId: z.uuid("Choose a draft scale."),
});

export const publishVersionSchema = z.object({
  versionId: z.uuid("Choose a draft to publish."),
});

export const createSkillSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a skill name.")
    .max(160, "Skill name must be 160 characters or fewer."),
  code: z.string().trim().min(1, "Enter a skill code."),
  category: optionalText(120, "Category must be 120 characters or fewer."),
  description: optionalText(
    2000,
    "Description must be 2,000 characters or fewer.",
  ),
  evidenceExpectations: optionalText(
    2000,
    "Evidence expectations must be 2,000 characters or fewer.",
  ),
});

export const createSkillsStandardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for this skills standard.")
    .max(160, "Name must be 160 characters or fewer."),
  code: z.string().trim().min(1, "Enter a code for this skills standard."),
  description: optionalText(
    2000,
    "Description must be 2,000 characters or fewer.",
  ),
});

export const addSkillRequirementSchema = z.object({
  capabilitySetVersionId: z.uuid("Choose a draft skills standard."),
  skillId: z.uuid("Choose a skill."),
  jobFunctionId: z.uuid("Choose a job function."),
  scaleVersionId: z.uuid("Choose a published proficiency scale."),
  levelId: z.uuid("Choose the required proficiency level."),
  organisationalUnitId: z.uuid("Choose a valid unit.").optional(),
  mandatory: z.boolean(),
  evidenceRequirement: optionalText(
    2000,
    "Evidence requirement must be 2,000 characters or fewer.",
  ),
  notes: optionalText(2000, "Notes must be 2,000 characters or fewer."),
});

export type ProficiencyLevelInput = z.infer<typeof proficiencyLevelInputSchema>;

export function firstSchemaMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export function proficiencyScalePublishIssues(input: {
  name: string;
  levels: Array<{ order: number; label: string }>;
}) {
  const issues: string[] = [];
  const name = input.name.trim();

  if (!name) {
    issues.push("Enter a scale name.");
  } else if (name.length > 160) {
    issues.push("Scale name must be 160 characters or fewer.");
  }

  if (input.levels.length < 2) {
    issues.push("Add at least two proficiency levels before publishing.");
  }

  if (input.levels.some((level) => !level.label.trim())) {
    issues.push("Every level needs a label.");
  }

  const orders = input.levels.map((level) => level.order);
  if (new Set(orders).size !== orders.length) {
    issues.push("Each level needs a unique order.");
  }

  return issues;
}
