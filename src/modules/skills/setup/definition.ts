import { z } from "zod";

import { generateSkillCatalogCode } from "@/modules/skills/catalog-code";
import { resolveUniqueSkillCatalogCode } from "@/modules/skills/catalog-code";
import type { SkillsStarterPack } from "@/modules/skills/templates/types";

const levelSchema = z.object({
  order: z.number().int().min(0).max(999),
  label: z.string().trim().min(1).max(120),
  guidance: z.string().trim().max(2000).nullable(),
});

const skillSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
  category: z.string().trim().max(120).nullable(),
  description: z.string().trim().max(2000).nullable(),
  evidence_expectations: z.string().trim().max(2000).nullable(),
});

const requirementSchema = z.object({
  skill_code: z.string().trim().toLowerCase().min(1).max(80),
  job_function_id: z.uuid(),
  level_label: z.string().trim().min(1).max(120),
  organisational_unit_id: z.uuid().nullable(),
  mandatory: z.boolean(),
  evidence_requirement: z.string().trim().max(2000).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export const skillsSetupDefinitionSchema = z.object({
  source: z.enum(["manual", "quick_start", "leanai"]),
  template_key: z.string().trim().min(1).max(80).nullable(),
  template_version: z.string().trim().min(1).max(40).nullable(),
  title: z.string().trim().min(1).max(160),
  applicability: z.enum(["organisation", "units"]),
  scale_resolution: z.enum(["create", "reuse", "create_alongside"]),
  sample: z.boolean(),
  scale: z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    levels: z.array(levelSchema).min(2).max(8),
  }),
  skills: z.array(skillSchema).min(1).max(24),
  standard: z.object({
    name: z.string().trim().min(1).max(160),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    description: z.string().trim().max(2000).nullable(),
  }),
  requirements: z.array(requirementSchema).max(80),
  unresolved_roles: z
    .array(
      z.object({
        suggested_role: z.string().trim().min(1).max(160),
        reason: z.string().trim().min(1).max(400),
      }),
    )
    .max(40),
});

export type SkillsSetupDefinition = z.infer<typeof skillsSetupDefinitionSchema>;

export type RoleMapping = {
  suggestedRole: string;
  jobFunctionId: string | null;
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function buildStarterPackDefinition(input: {
  pack: SkillsStarterPack;
  applicability: "organisation" | "units";
  unitIds: readonly string[];
  roleMappings: readonly RoleMapping[];
  scaleResolution: SkillsSetupDefinition["scale_resolution"];
  existingCodes?: readonly string[];
}):
  | { ok: true; definition: SkillsSetupDefinition }
  | { ok: false; message: string } {
  const codes = [...(input.existingCodes ?? [])];
  const skills = input.pack.skills.map((skill) => {
    const code = resolveUniqueSkillCatalogCode(
      generateSkillCatalogCode(skill.name),
      codes,
    );
    codes.push(code);
    return {
      name: skill.name,
      code,
      category: skill.category,
      description: skill.description,
      evidence_expectations: skill.evidenceExpectations,
    };
  });
  const skillCodeByName = new Map(
    skills.map((skill) => [skill.name.trim().toLowerCase(), skill.code]),
  );
  const mappedRoles = new Map(
    input.roleMappings.map((mapping) => [
      mapping.suggestedRole.trim().toLowerCase(),
      mapping.jobFunctionId,
    ]),
  );
  const unresolved: SkillsSetupDefinition["unresolved_roles"] = [];
  const requirements: SkillsSetupDefinition["requirements"] = [];
  const units =
    input.applicability === "units" ? input.unitIds.filter(Boolean) : [null];

  if (input.applicability === "units" && units.length === 0) {
    return {
      ok: false,
      message:
        "Choose at least one organisational unit, or apply the requirements across the organisation.",
    };
  }

  for (const role of input.pack.suggestedRoles) {
    const jobFunctionId =
      mappedRoles.get(role.title.trim().toLowerCase()) ?? null;
    if (!jobFunctionId) {
      unresolved.push({
        suggested_role: role.title,
        reason:
          "Not mapped to an existing job function. No requirement was created for this role.",
      });
    }
  }

  for (const requirement of input.pack.requirements) {
    const jobFunctionId =
      mappedRoles.get(requirement.roleTitle.trim().toLowerCase()) ?? null;
    const skillCode = skillCodeByName.get(
      requirement.skillName.trim().toLowerCase(),
    );
    if (!skillCode) {
      return {
        ok: false,
        message: "A suggested requirement refers to a missing skill.",
      };
    }
    if (!jobFunctionId) {
      continue;
    }
    for (const unitId of units) {
      requirements.push({
        skill_code: skillCode,
        job_function_id: jobFunctionId,
        level_label: requirement.levelLabel,
        organisational_unit_id: unitId,
        mandatory: true,
        evidence_requirement: requirement.evidence,
        notes: input.pack.disclaimer,
      });
    }
  }

  const parsed = skillsSetupDefinitionSchema.safeParse({
    source: "quick_start",
    template_key: input.pack.key,
    template_version: input.pack.version,
    title: `Sample: ${input.pack.name}`,
    applicability: input.applicability,
    scale_resolution: input.scaleResolution,
    sample: true,
    scale: {
      name: input.pack.scaleName,
      description: input.pack.scaleDescription,
      levels: input.pack.levels.map((level) => ({
        order: level.order,
        label: level.label,
        guidance: level.guidance,
      })),
    },
    skills,
    standard: {
      name: `Sample: ${input.pack.name} requirements`,
      code: resolveUniqueSkillCatalogCode(
        generateSkillCatalogCode(`${input.pack.name} requirements`),
        codes,
      ),
      description: input.pack.disclaimer ?? input.pack.summary,
    },
    requirements,
    unresolved_roles: unresolved,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "The starter pack could not be prepared. Check the role mapping and try again.",
    };
  }
  return { ok: true, definition: parsed.data };
}

export function describeRequirementApplicability(input: {
  jobFunctionName: string;
  skillName: string;
  levelLabel: string;
  unitName: string | null;
}): string {
  const where = input.unitName
    ? `at ${input.unitName}`
    : "wherever that job function is used in the organisation";
  return `${input.jobFunctionName} ${where} must demonstrate "${input.skillName}" at "${input.levelLabel}". The skills catalogue and proficiency scale still belong to the whole organisation. A selected site does not limit them. Nobody is assessed or marked competent by creating this requirement. Not assessed is not a low score.`;
}

export function parseStoredSkillsDefinition(
  value: unknown,
): SkillsSetupDefinition | null {
  const parsed = skillsSetupDefinitionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export { emptyToNull };
