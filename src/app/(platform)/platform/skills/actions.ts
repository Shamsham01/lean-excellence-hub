"use server";

import { revalidatePath } from "next/cache";

import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { validateSkillCatalogCode } from "@/modules/skills/catalog-code";
import {
  skillsCatalogDeniedMessage,
  skillsRequirementsDeniedMessage,
  toSkillsAuthoringError,
} from "@/modules/skills/errors";
import {
  addProficiencyLevelSchema,
  addSkillRequirementSchema,
  createProficiencyScaleSchema,
  createSkillSchema,
  createSkillsStandardSchema,
  firstSchemaMessage,
  proficiencyScalePublishIssues,
  publishVersionSchema,
} from "@/modules/skills/validation";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const SKILLS_PATHS = [
  "/platform/skills",
  "/platform/skills/catalog",
  "/platform/skills/scales",
  "/platform/skills/standards",
  "/platform/skills/matrix",
] as const;

function revalidateSkills(paths: string[] = []) {
  for (const path of [...SKILLS_PATHS, ...paths]) {
    revalidatePath(path);
  }
}

async function requireCatalogManage() {
  const allowed = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.catalogManage,
  );

  if (!allowed) {
    return { error: skillsCatalogDeniedMessage() };
  }

  return null;
}

async function requireRequirementsManage() {
  const allowed = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.requirementsManage,
  );

  if (!allowed) {
    return { error: skillsRequirementsDeniedMessage() };
  }

  return null;
}

export async function createProficiencyScale(input: {
  name: string;
  description?: string;
  levels: Array<{
    order: number;
    label: string;
    description?: string;
    guidance?: string;
  }>;
}) {
  const denied = await requireCatalogManage();
  if (denied) {
    return denied;
  }

  const parsed = createProficiencyScaleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: scaleId, error: createError } = await supabase.rpc(
    "create_skill_proficiency_scale_draft",
    {
      target_name: parsed.data.name,
      ...(parsed.data.description
        ? { target_description: parsed.data.description }
        : {}),
    },
  );

  if (createError || !scaleId) {
    return {
      error: toSkillsAuthoringError(
        createError,
        "Unable to create this proficiency scale. Check the details and try again.",
      ),
    };
  }

  const { data: version, error: versionError } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id")
    .eq("scale_id", scaleId)
    .eq("status", "draft")
    .maybeSingle();

  if (versionError || !version) {
    revalidateSkills([`/platform/skills/scales/${scaleId}`]);
    return {
      scaleId,
      error:
        "The draft was created, but its levels could not be opened. Continue from the scale.",
    };
  }

  for (const level of parsed.data.levels) {
    const { error } = await supabase.rpc("add_skill_proficiency_level", {
      target_scale_version_id: version.id,
      target_order_value: level.order,
      target_label: level.label,
      ...(level.description ? { target_description: level.description } : {}),
      ...(level.guidance ? { target_guidance: level.guidance } : {}),
    });

    if (error) {
      revalidateSkills([`/platform/skills/scales/${scaleId}`]);
      return {
        scaleId,
        error: toSkillsAuthoringError(
          error,
          "Some levels could not be saved. Continue on the draft and add the remaining levels.",
        ),
      };
    }
  }

  revalidateSkills([`/platform/skills/scales/${scaleId}`]);
  return { scaleId };
}

export async function addProficiencyLevel(input: {
  scaleVersionId: string;
  order: number;
  label: string;
  description?: string;
  guidance?: string;
}) {
  const denied = await requireCatalogManage();
  if (denied) {
    return denied;
  }

  const parsed = addProficiencyLevelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: version } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id, scale_id, status")
    .eq("id", parsed.data.scaleVersionId)
    .maybeSingle();

  if (!version) {
    return { error: "That proficiency scale could not be found." };
  }

  if (version.status !== "draft") {
    return {
      error:
        "Published and archived scales are read-only. Levels can only be added to a draft.",
    };
  }

  const { error } = await supabase.rpc("add_skill_proficiency_level", {
    target_scale_version_id: parsed.data.scaleVersionId,
    target_order_value: parsed.data.order,
    target_label: parsed.data.label,
    ...(parsed.data.description
      ? { target_description: parsed.data.description }
      : {}),
    ...(parsed.data.guidance ? { target_guidance: parsed.data.guidance } : {}),
  });

  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "Unable to add this level. Check the label and order.",
      ),
    };
  }

  revalidateSkills([`/platform/skills/scales/${version.scale_id}`]);
  return { ok: true as const };
}

export async function publishProficiencyScale(input: { versionId: string }) {
  const denied = await requireCatalogManage();
  if (denied) {
    return denied;
  }

  const parsed = publishVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: version } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id, scale_id, status")
    .eq("id", parsed.data.versionId)
    .maybeSingle();

  if (!version) {
    return { error: "That proficiency scale could not be found." };
  }

  if (version.status !== "draft") {
    return {
      error: "Only a draft scale can be published. This version is read-only.",
    };
  }

  const { data: scale } = await supabase
    .from("skill_proficiency_scales")
    .select("name")
    .eq("id", version.scale_id)
    .maybeSingle();

  const { data: levels } = await supabase
    .from("skill_proficiency_levels")
    .select("order_value, label")
    .eq("scale_version_id", version.id);

  const issues = proficiencyScalePublishIssues({
    name: scale?.name ?? "",
    levels: (levels ?? []).map((level) => ({
      order: level.order_value,
      label: level.label,
    })),
  });

  if (issues.length > 0) {
    return { error: issues[0] ?? "This scale is not ready to publish." };
  }

  const { error } = await supabase.rpc(
    "publish_skill_proficiency_scale_version",
    { target_scale_version_id: version.id },
  );

  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "Unable to publish this proficiency scale.",
      ),
    };
  }

  revalidateSkills([`/platform/skills/scales/${version.scale_id}`]);
  return { ok: true as const };
}

export async function createSkill(input: {
  name: string;
  code: string;
  category?: string;
  description?: string;
  evidenceExpectations?: string;
}) {
  const denied = await requireCatalogManage();
  if (denied) {
    return denied;
  }

  const parsed = createSkillSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const code = validateSkillCatalogCode(parsed.data.code);
  if (!code.ok) {
    return { error: code.message };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_skill", {
    target_name: parsed.data.name,
    target_code: code.normalised,
    ...(parsed.data.category ? { target_category: parsed.data.category } : {}),
    ...(parsed.data.description
      ? { target_description: parsed.data.description }
      : {}),
    ...(parsed.data.evidenceExpectations
      ? { target_evidence_expectations: parsed.data.evidenceExpectations }
      : {}),
  });

  if (error || !data) {
    return {
      error: toSkillsAuthoringError(
        error,
        "Unable to create this skill. Check the details and try again.",
      ),
    };
  }

  revalidateSkills([`/platform/skills/${data}`]);
  return { skillId: data };
}

export async function createSkillsStandard(input: {
  name: string;
  code: string;
  description?: string;
}) {
  const denied = await requireRequirementsManage();
  if (denied) {
    return denied;
  }

  const parsed = createSkillsStandardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const code = validateSkillCatalogCode(parsed.data.code);
  if (!code.ok) {
    return { error: code.message };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_skill_capability_set_draft",
    {
      target_name: parsed.data.name,
      target_code: code.normalised,
      ...(parsed.data.description
        ? { target_description: parsed.data.description }
        : {}),
    },
  );

  if (error || !data) {
    return {
      error: toSkillsAuthoringError(
        error,
        "Unable to create this skills standard. Check the details and try again.",
      ),
    };
  }

  revalidateSkills([`/platform/skills/standards/${data}`]);
  return { standardId: data };
}

export async function addSkillRequirement(input: {
  capabilitySetVersionId: string;
  skillId: string;
  jobFunctionId: string;
  scaleVersionId: string;
  levelId: string;
  organisationalUnitId?: string;
  mandatory: boolean;
  evidenceRequirement?: string;
  notes?: string;
}) {
  const denied = await requireRequirementsManage();
  if (denied) {
    return denied;
  }

  const parsed = addSkillRequirementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const readiness = await requirementReadiness(supabase, parsed.data);
  if (readiness) {
    return readiness;
  }

  const { data: existing } = await supabase
    .from("skill_requirements")
    .select("id, organisational_unit_id")
    .eq("capability_set_version_id", parsed.data.capabilitySetVersionId)
    .eq("skill_id", parsed.data.skillId)
    .eq("job_function_id", parsed.data.jobFunctionId);

  const duplicate = (existing ?? []).some(
    (row) =>
      (row.organisational_unit_id ?? null) ===
      (parsed.data.organisationalUnitId ?? null),
  );

  if (duplicate) {
    return {
      error: "That skill is already required for this job function.",
    };
  }

  const { error } = await supabase.rpc("add_skill_requirement", {
    target_capability_set_version_id: parsed.data.capabilitySetVersionId,
    target_skill_id: parsed.data.skillId,
    target_job_function_id: parsed.data.jobFunctionId,
    target_proficiency_scale_version_id: parsed.data.scaleVersionId,
    target_target_proficiency_level_id: parsed.data.levelId,
    target_mandatory: parsed.data.mandatory,
    ...(parsed.data.organisationalUnitId
      ? { target_organisational_unit_id: parsed.data.organisationalUnitId }
      : {}),
    ...(parsed.data.evidenceRequirement
      ? { target_evidence_requirement: parsed.data.evidenceRequirement }
      : {}),
    ...(parsed.data.notes ? { target_notes: parsed.data.notes } : {}),
  });

  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "Unable to add this capability requirement.",
      ),
    };
  }

  revalidateSkills();
  return { ok: true as const };
}

export async function publishSkillsStandard(input: { versionId: string }) {
  const denied = await requireRequirementsManage();
  if (denied) {
    return denied;
  }

  const parsed = publishVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstSchemaMessage(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: version } = await supabase
    .from("skill_capability_set_versions")
    .select("id, capability_set_id, status")
    .eq("id", parsed.data.versionId)
    .maybeSingle();

  if (!version) {
    return { error: "That skills standard could not be found." };
  }

  if (version.status !== "draft") {
    return {
      error:
        "Only a draft skills standard can be published. This version is read-only.",
    };
  }

  const { data: requirements } = await supabase
    .from("skill_requirements")
    .select(
      "skill_id, job_function_id, proficiency_scale_version_id, target_proficiency_level_id",
    )
    .eq("capability_set_version_id", version.id);

  if (!requirements?.length) {
    return {
      error: "Add at least one capability requirement before publishing.",
    };
  }

  for (const requirement of requirements) {
    const issue = await requirementReadiness(supabase, {
      capabilitySetVersionId: version.id,
      skillId: requirement.skill_id,
      jobFunctionId: requirement.job_function_id ?? "",
      scaleVersionId: requirement.proficiency_scale_version_id,
      levelId: requirement.target_proficiency_level_id,
      mandatory: true,
    });

    if (issue) {
      return issue;
    }
  }

  const { error } = await supabase.rpc("publish_skill_capability_set_version", {
    target_capability_set_version_id: version.id,
  });

  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "Unable to publish this skills standard.",
      ),
    };
  }

  revalidateSkills([
    `/platform/skills/standards/${version.capability_set_id}`,
    "/platform/people",
  ]);
  return { ok: true as const };
}

async function requirementReadiness(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    capabilitySetVersionId: string;
    skillId: string;
    jobFunctionId: string;
    scaleVersionId: string;
    levelId: string;
    mandatory: boolean;
    organisationalUnitId?: string | undefined;
  },
) {
  const { data: version } = await supabase
    .from("skill_capability_set_versions")
    .select("id, status")
    .eq("id", input.capabilitySetVersionId)
    .maybeSingle();

  if (!version) {
    return { error: "That skills standard could not be found." };
  }

  if (version.status !== "draft") {
    return {
      error:
        "Published skills standards are read-only. Add requirements to a draft.",
    };
  }

  const { data: skill } = await supabase
    .from("skills")
    .select("id, status")
    .eq("id", input.skillId)
    .maybeSingle();

  if (!skill || skill.status !== "active") {
    return { error: "Choose an active skill." };
  }

  const { data: jobFunction } = await supabase
    .from("job_functions")
    .select("id, status")
    .eq("id", input.jobFunctionId)
    .maybeSingle();

  if (!jobFunction || jobFunction.status !== "active") {
    return { error: "Choose an active job function." };
  }

  const { data: scaleVersion } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id, status")
    .eq("id", input.scaleVersionId)
    .maybeSingle();

  if (!scaleVersion || scaleVersion.status !== "published") {
    return { error: "Choose a published proficiency scale." };
  }

  const { data: level } = await supabase
    .from("skill_proficiency_levels")
    .select("id, scale_version_id")
    .eq("id", input.levelId)
    .maybeSingle();

  if (!level || level.scale_version_id !== input.scaleVersionId) {
    return {
      error: "That proficiency level does not belong to the published scale.",
    };
  }

  if (input.organisationalUnitId) {
    const { data: unit } = await supabase
      .from("organisation_units")
      .select("id, status")
      .eq("id", input.organisationalUnitId)
      .maybeSingle();

    if (!unit || unit.status !== "active") {
      return {
        error: "Choose an active organisational unit, or leave it blank.",
      };
    }
  }

  return null;
}
