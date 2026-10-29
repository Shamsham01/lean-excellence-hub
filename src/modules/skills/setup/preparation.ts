import { z } from "zod";

import { generateSkillCatalogCode } from "@/modules/skills/catalog-code";
import { resolveUniqueSkillCatalogCode } from "@/modules/skills/catalog-code";
import {
  skillsSetupDefinitionSchema,
  type SkillsSetupDefinition,
} from "@/modules/skills/setup/definition";

const requirementDraft = z.object({
  skillName: z.string().trim().min(1).max(160),
  jobFunctionId: z.uuid(),
  levelLabel: z.string().trim().min(1).max(120),
  unitId: z.uuid().nullable(),
  evidence: z.string().trim().max(2000).default(""),
});

const levelDraftLoose = z.object({
  order: z.number().int().min(0).max(999),
  label: z.string().trim().max(120).default(""),
  guidance: z.string().trim().max(2000).default(""),
});

const skillDraftLoose = z.object({
  name: z.string().trim().max(160).default(""),
  category: z.string().trim().max(120).default(""),
  evidence: z.string().trim().max(2000).default(""),
});

export const manualSkillsPreparationSchema = z.object({
  idempotencyKey: z.uuid(),
  step: z.enum(["scale", "skills", "requirements", "preview"]),
  scaleName: z.string().trim().max(160).default(""),
  scaleDescription: z.string().trim().max(2000).default(""),
  levels: z.array(levelDraftLoose).max(8),
  skills: z.array(skillDraftLoose).max(24),
  requirements: z.array(requirementDraft).max(80),
  applicability: z.enum(["organisation", "units"]),
  unitIds: z.array(z.uuid()).max(50),
  scaleResolution: z.enum(["create", "reuse", "create_alongside"]),
});

export type ManualSkillsPreparation = z.infer<
  typeof manualSkillsPreparationSchema
>;

export const quickStartPreparationSchema = z.object({
  idempotencyKey: z.uuid(),
  applicability: z.enum(["organisation", "units"]),
  unitIds: z.array(z.uuid()).max(50),
  roleMappings: z
    .array(
      z.object({
        suggestedRole: z.string().trim().min(1).max(160),
        jobFunctionId: z.uuid().nullable(),
      }),
    )
    .max(40),
  scaleResolution: z.enum(["create", "reuse", "create_alongside"]),
});

export type QuickStartPreparation = z.infer<typeof quickStartPreparationSchema>;

export const leanAiPreparationSchema = quickStartPreparationSchema;

export function manualPreparationToDefinition(
  state: ManualSkillsPreparation,
  allowedJobFunctionIds: ReadonlySet<string>,
  allowedUnitIds: ReadonlySet<string>,
):
  | { ok: true; definition: SkillsSetupDefinition }
  | { ok: false; message: string } {
  if (state.applicability === "units" && state.unitIds.length === 0) {
    return {
      ok: false,
      message:
        "Choose at least one unit, or apply requirements wherever the job function is used.",
    };
  }
  const readyLevels = state.levels.filter((level) => level.label.trim());
  const readySkills = state.skills.filter((skill) => skill.name.trim());
  if (!state.scaleName.trim() || readyLevels.length < 2) {
    return {
      ok: false,
      message:
        "Name the scale and add at least two levels before creating the draft.",
    };
  }
  if (readySkills.length === 0) {
    return {
      ok: false,
      message: "Add at least one skill before creating the draft.",
    };
  }
  const codes: string[] = [];
  const skills = readySkills.map((skill) => {
    const code = resolveUniqueSkillCatalogCode(
      generateSkillCatalogCode(skill.name),
      codes,
    );
    codes.push(code);
    return { skill, code };
  });
  const codeByName = new Map(
    skills.map((item) => [item.skill.name.toLowerCase(), item.code]),
  );
  const requirements: SkillsSetupDefinition["requirements"] = [];
  for (const requirement of state.requirements) {
    if (!allowedJobFunctionIds.has(requirement.jobFunctionId)) {
      return {
        ok: false,
        message: "Choose a job function from this organisation.",
      };
    }
    if (requirement.unitId && !allowedUnitIds.has(requirement.unitId)) {
      return { ok: false, message: "Choose a unit from this organisation." };
    }
    const skillCode = codeByName.get(requirement.skillName.toLowerCase());
    if (!skillCode) {
      return {
        ok: false,
        message: "Each requirement must use a skill from this setup.",
      };
    }
    const unitId =
      state.applicability === "organisation" ? null : requirement.unitId;
    requirements.push({
      skill_code: skillCode,
      job_function_id: requirement.jobFunctionId,
      level_label: requirement.levelLabel,
      organisational_unit_id: unitId,
      mandatory: true,
      evidence_requirement: requirement.evidence || null,
      notes: null,
    });
  }

  const parsed = skillsSetupDefinitionSchema.safeParse({
    source: "manual",
    template_key: null,
    template_version: null,
    title: state.scaleName,
    applicability: state.applicability,
    scale_resolution: state.scaleResolution,
    sample: false,
    scale: {
      name: state.scaleName,
      description: state.scaleDescription || null,
      levels: readyLevels.map((level) => ({
        order: level.order,
        label: level.label,
        guidance: level.guidance || null,
      })),
    },
    skills: skills.map((item) => ({
      name: item.skill.name,
      code: item.code,
      category: item.skill.category || null,
      description: null,
      evidence_expectations: item.skill.evidence || null,
    })),
    standard: {
      name: `${state.scaleName} requirements`,
      code: resolveUniqueSkillCatalogCode(
        generateSkillCatalogCode(`${state.scaleName} requirements`),
        codes,
      ),
      description: "Role requirements created in guided Skills setup.",
    },
    requirements,
    unresolved_roles: [],
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the scale, skills, and requirements, then try again.",
    };
  }
  return { ok: true, definition: parsed.data };
}
