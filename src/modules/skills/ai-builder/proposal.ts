import { z } from "zod";

import { boundedText } from "@/modules/module-setup/text";
import { generateSkillCatalogCode } from "@/modules/skills/catalog-code";
import { resolveUniqueSkillCatalogCode } from "@/modules/skills/catalog-code";
import {
  skillsSetupDefinitionSchema,
  type SkillsSetupDefinition,
} from "@/modules/skills/setup/definition";

import {
  SKILLS_BUILDER_DECLARED_KEY,
  SKILLS_BUILDER_LIMITS as LIMITS,
  type SkillsBuilderProposal,
} from "./types";

function requirePresent(
  result: { ok: true; value: string | null } | { ok: false; issue: string },
): string | null {
  if (!result.ok || !result.value) {
    return null;
  }
  return result.value;
}

const rawLevelSchema = z
  .object({
    order: z.number(),
    label: z.string(),
    guidance: z.string().nullable(),
  })
  .strict();

const rawSkillSchema = z
  .object({
    name: z.string(),
    category: z.string().nullable(),
    description: z.string().nullable(),
    evidence_expectations: z.string().nullable(),
  })
  .strict();

const rawRequirementSchema = z
  .object({
    skill_name: z.string(),
    suggested_job_function: z.string(),
    level_label: z.string(),
    evidence_requirement: z.string().nullable(),
  })
  .strict();

export const rawSkillsBuilderProposalSchema = z
  .object({
    title: z.string(),
    scale: z
      .object({
        name: z.string(),
        description: z.string().nullable(),
        levels: z.array(rawLevelSchema),
      })
      .strict(),
    skills: z.array(rawSkillSchema),
    requirements: z.array(rawRequirementSchema),
    notes: z.array(z.string()),
  })
  .strict();

const understandingSchema = z
  .object({
    operation: z.string().nullable(),
    scale: z.string().nullable(),
    roles: z.string().nullable(),
    evidence: z.string().nullable(),
    applicability: z.string().nullable(),
  })
  .strict();

export const rawSkillsBuilderEnvelopeSchema = z
  .object({
    message: z.string(),
    phase: z.enum(["discovery", "proposal"]),
    understanding: understandingSchema,
    questions: z.array(
      z
        .object({
          question: z.string(),
          suggested_answers: z.array(z.string()),
        })
        .strict(),
    ),
    change_summary: z.array(z.string()),
    proposal: rawSkillsBuilderProposalSchema.nullable(),
  })
  .strict();

const FORBIDDEN_PROPOSAL =
  /assessment|competent employee|grant permission|publish now|employee id/i;

export function validateSkillsBuilderProposal(
  raw: z.infer<typeof rawSkillsBuilderProposalSchema>,
):
  | { ok: true; proposal: SkillsBuilderProposal }
  | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const title = boundedText(raw.title, LIMITS.nameMax, true);
  if (!title.ok) issues.push("Proposal title is missing or too long.");
  const scaleName = boundedText(raw.scale.name, LIMITS.nameMax, true);
  if (!scaleName.ok) issues.push("Scale name is missing or too long.");
  const scaleDescription = boundedText(
    raw.scale.description ?? "",
    LIMITS.textMax,
    false,
  );
  if (!scaleDescription.ok) issues.push("Scale description is too long.");
  if (
    raw.scale.levels.length < LIMITS.minLevels ||
    raw.scale.levels.length > LIMITS.maxLevels
  ) {
    issues.push(
      `Use between ${LIMITS.minLevels} and ${LIMITS.maxLevels} proficiency levels.`,
    );
  }
  if (
    raw.skills.length < LIMITS.minSkills ||
    raw.skills.length > LIMITS.maxSkills
  ) {
    issues.push(
      `Use between ${LIMITS.minSkills} and ${LIMITS.maxSkills} skills.`,
    );
  }
  if (raw.requirements.length > LIMITS.maxRequirements) {
    issues.push(`Use at most ${LIMITS.maxRequirements} requirements.`);
  }

  const levels: SkillsBuilderProposal["scale"]["levels"] = [];
  const seenOrders = new Set<number>();
  const seenLabels = new Set<string>();
  for (const level of raw.scale.levels) {
    const label = requirePresent(boundedText(level.label, 120, true));
    const guidance = boundedText(level.guidance ?? "", LIMITS.textMax, false);
    if (!label || !guidance.ok || !Number.isInteger(level.order)) {
      issues.push("Each level needs a whole-number order and a label.");
      continue;
    }
    if (seenOrders.has(level.order) || seenLabels.has(label.toLowerCase())) {
      issues.push("Level orders and labels must be unique.");
    }
    seenOrders.add(level.order);
    seenLabels.add(label.toLowerCase());
    levels.push({
      order: level.order,
      label,
      guidance: guidance.value || null,
    });
  }

  const skills: SkillsBuilderProposal["skills"] = [];
  const skillNames = new Set<string>();
  for (const skill of raw.skills) {
    const name = requirePresent(boundedText(skill.name, LIMITS.nameMax, true));
    const category = boundedText(skill.category ?? "", 120, false);
    const description = boundedText(
      skill.description ?? "",
      LIMITS.textMax,
      false,
    );
    const evidence = boundedText(
      skill.evidence_expectations ?? "",
      LIMITS.textMax,
      false,
    );
    if (!name || !category.ok || !description.ok || !evidence.ok) {
      issues.push("A skill name or description is missing or too long.");
      continue;
    }
    if (FORBIDDEN_PROPOSAL.test(name)) {
      issues.push("A skill cannot record an assessment or a permission.");
    }
    skillNames.add(name.toLowerCase());
    skills.push({
      name,
      category: category.value || null,
      description: description.value || null,
      evidenceExpectations: evidence.value || null,
    });
  }

  const requirements: SkillsBuilderProposal["requirements"] = [];
  for (const requirement of raw.requirements) {
    const skillName = requirePresent(
      boundedText(requirement.skill_name, LIMITS.nameMax, true),
    );
    const role = requirePresent(
      boundedText(requirement.suggested_job_function, LIMITS.nameMax, true),
    );
    const levelLabel = requirePresent(
      boundedText(requirement.level_label, 120, true),
    );
    const evidence = boundedText(
      requirement.evidence_requirement ?? "",
      LIMITS.textMax,
      false,
    );
    if (!skillName || !role || !levelLabel || !evidence.ok) {
      issues.push("A requirement is missing a skill, role, or level.");
      continue;
    }
    if (!skillNames.has(skillName.toLowerCase())) {
      issues.push(`Requirement skill "${skillName}" is not in the catalogue.`);
    }
    if (!seenLabels.has(levelLabel.toLowerCase())) {
      issues.push(`Requirement level "${levelLabel}" is not on the scale.`);
    }
    requirements.push({
      skillName,
      suggestedJobFunction: role,
      levelLabel,
      evidenceRequirement: evidence.value || null,
    });
  }

  const notes = raw.notes
    .flatMap((note) => {
      const text = requirePresent(boundedText(note, 240, false));
      return text ? [text] : [];
    })
    .slice(0, 8);
  const titleText = requirePresent(title);
  const scaleNameText = requirePresent(scaleName);

  if (!titleText || !scaleNameText || issues.length > 0) {
    return {
      ok: false,
      issues: issues.length > 0 ? issues : ["Proposal is incomplete."],
    };
  }

  return {
    ok: true,
    proposal: {
      title: titleText,
      scale: {
        name: scaleNameText,
        description: scaleDescription.ok
          ? scaleDescription.value || null
          : null,
        levels,
      },
      skills,
      requirements,
      notes,
    },
  };
}

export function parseSkillsBuilderEnvelope(value: unknown):
  | {
      ok: true;
      envelope: {
        message: string;
        phase: "discovery" | "proposal";
        understanding: Record<string, string | null>;
        questions: Array<{ question: string; suggestedAnswers: string[] }>;
        changeSummary: string[];
        proposal: SkillsBuilderProposal | null;
        proposalStatus: "none" | "valid" | "invalid";
        proposalIssues: string[];
      };
    }
  | { ok: false; issues: string[] } {
  const parsed = rawSkillsBuilderEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: ["LeanAI returned an unexpected Skills proposal."],
    };
  }
  const message = requirePresent(boundedText(parsed.data.message, 2000, true));
  if (!message) {
    return { ok: false, issues: ["LeanAI's message was empty or too long."] };
  }
  let proposal: SkillsBuilderProposal | null = null;
  let proposalStatus: "none" | "valid" | "invalid" = "none";
  let proposalIssues: string[] = [];
  if (parsed.data.proposal) {
    const validated = validateSkillsBuilderProposal(parsed.data.proposal);
    if (validated.ok) {
      proposal = validated.proposal;
      proposalStatus = "valid";
    } else {
      proposalStatus = "invalid";
      proposalIssues = validated.issues;
    }
  }
  return {
    ok: true,
    envelope: {
      message,
      phase: parsed.data.phase,
      understanding: parsed.data.understanding,
      questions: parsed.data.questions.map((question) => ({
        question: question.question,
        suggestedAnswers: question.suggested_answers,
      })),
      changeSummary: parsed.data.change_summary,
      proposal,
      proposalStatus,
      proposalIssues,
    },
  };
}

export function revalidateStoredSkillsProposal(
  value: unknown,
): SkillsBuilderProposal | null {
  const parsed = rawSkillsBuilderProposalSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const validated = validateSkillsBuilderProposal(parsed.data);
  return validated.ok ? validated.proposal : null;
}

export function skillsProposalToDefinition(input: {
  proposal: SkillsBuilderProposal;
  applicability: "organisation" | "units";
  unitIds: readonly string[];
  roleMappings: ReadonlyArray<{
    suggestedRole: string;
    jobFunctionId: string | null;
  }>;
  allowedJobFunctionIds: ReadonlySet<string>;
  allowedUnitIds: ReadonlySet<string>;
}):
  | { ok: true; definition: SkillsSetupDefinition }
  | { ok: false; message: string } {
  if (input.applicability === "units" && input.unitIds.length === 0) {
    return {
      ok: false,
      message:
        "Choose the units this requirement applies to, or choose the whole organisation.",
    };
  }
  for (const unitId of input.unitIds) {
    if (!input.allowedUnitIds.has(unitId)) {
      return {
        ok: false,
        message: "One of the selected units is not in this organisation.",
      };
    }
  }
  const codes: string[] = [];
  const skills = input.proposal.skills.map((skill) => {
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
  const mapped = new Map(
    input.roleMappings.map((mapping) => [
      mapping.suggestedRole.trim().toLowerCase(),
      mapping.jobFunctionId,
    ]),
  );
  const unresolved: SkillsSetupDefinition["unresolved_roles"] = [];
  const requirements: SkillsSetupDefinition["requirements"] = [];
  const roles = new Set(
    input.proposal.requirements.map((item) => item.suggestedJobFunction),
  );
  for (const role of roles) {
    const jobFunctionId = mapped.get(role.trim().toLowerCase()) ?? null;
    if (!jobFunctionId || !input.allowedJobFunctionIds.has(jobFunctionId)) {
      unresolved.push({
        suggested_role: role,
        reason: "Not confirmed against an existing job function.",
      });
    }
  }
  const units = input.applicability === "units" ? input.unitIds : [null];
  for (const requirement of input.proposal.requirements) {
    const jobFunctionId =
      mapped.get(requirement.suggestedJobFunction.trim().toLowerCase()) ?? null;
    if (!jobFunctionId || !input.allowedJobFunctionIds.has(jobFunctionId)) {
      continue;
    }
    const skillCode = codeByName.get(requirement.skillName.toLowerCase());
    if (!skillCode) {
      return {
        ok: false,
        message:
          "The stored proposal refers to a skill that is not in the catalogue.",
      };
    }
    for (const unitId of units) {
      requirements.push({
        skill_code: skillCode,
        job_function_id: jobFunctionId,
        level_label: requirement.levelLabel,
        organisational_unit_id: unitId,
        mandatory: true,
        evidence_requirement: requirement.evidenceRequirement,
        notes: "Proposed by LeanAI. Not applied until you publish.",
      });
    }
  }

  const parsed = skillsSetupDefinitionSchema.safeParse({
    source: "leanai",
    template_key: SKILLS_BUILDER_DECLARED_KEY,
    template_version: "1",
    title: input.proposal.title,
    applicability: input.applicability,
    scale_resolution: "create",
    sample: false,
    scale: {
      name: input.proposal.scale.name,
      description: input.proposal.scale.description,
      levels: input.proposal.scale.levels,
    },
    skills: skills.map((item) => ({
      name: item.skill.name,
      code: item.code,
      category: item.skill.category,
      description: item.skill.description,
      evidence_expectations: item.skill.evidenceExpectations,
    })),
    standard: {
      name: `${input.proposal.title} requirements`,
      code: resolveUniqueSkillCatalogCode(
        generateSkillCatalogCode(`${input.proposal.title} requirements`),
        codes,
      ),
      description:
        "Draft from LeanAI. Review the requirements before publishing.",
    },
    requirements,
    unresolved_roles: unresolved,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "The stored proposal is no longer valid. Ask LeanAI to propose it again.",
    };
  }
  return { ok: true, definition: parsed.data };
}
