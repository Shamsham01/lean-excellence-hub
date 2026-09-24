"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildAuthoringSavedRedirectPath } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { optionalPositiveInteger } from "@/modules/training/catalog-admin";
import {
  findOverlappingTrainingRequirement,
  optionalNonNegativeInteger,
  resolveTrainingRequirementTarget,
  type TrainingRequirementApplicabilityMode,
} from "@/modules/training/curriculum-admin";
import { validateTrainingCurriculumCode } from "@/modules/training/curriculum-code";
import {
  toTrainingCurriculumErrorMessage,
  trainingCurriculumManageDeniedMessage,
} from "@/modules/training/curriculum-errors";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const CURRICULUM_PATHS = [
  "/platform/training",
  "/platform/training/curriculum",
  "/platform/training/matrix",
  "/platform/setup",
] as const;

type CurriculumActionError = { error: string };

type RequirementMutationInput = {
  curriculumId: string;
  versionId: string;
  requirementId?: string;
  courseId: string;
  applicabilityMode: TrainingRequirementApplicabilityMode | string;
  jobFunctionId?: string | null;
  organisationalUnitId?: string | null;
  mandatory?: boolean;
  requiredWithinDays?: string | number | null;
  validityDaysOverride?: string | number | null;
  gracePeriodDays?: string | number | null;
  notes?: string | null;
};

async function requireTrainingCurriculumManage() {
  const canManage = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.curriculumManage,
  );

  if (!canManage) {
    return { error: trainingCurriculumManageDeniedMessage() };
  }

  return null;
}

function revalidateTrainingCurriculum(curriculumId?: string) {
  for (const path of CURRICULUM_PATHS) {
    revalidatePath(path);
  }

  if (curriculumId) {
    revalidatePath(`/platform/training/curriculum/${curriculumId}`);
  }
}

function buildRequirementRpcArgs(input: {
  courseId: string;
  appliesToAllMembers: boolean;
  jobFunctionId: string | null;
  organisationalUnitId: string | null;
  mandatory: boolean;
  requiredWithinDays: number | null;
  validityDaysOverride: number | null;
  gracePeriodDays: number | null;
  notes?: string;
}) {
  return {
    target_course_id: input.courseId,
    target_applies_to_all_members: input.appliesToAllMembers,
    target_mandatory: input.mandatory,
    ...(input.jobFunctionId
      ? { target_job_function_id: input.jobFunctionId }
      : {}),
    ...(input.organisationalUnitId
      ? { target_organisational_unit_id: input.organisationalUnitId }
      : {}),
    ...(input.requiredWithinDays != null
      ? { target_required_within_days: input.requiredWithinDays }
      : {}),
    ...(input.validityDaysOverride != null
      ? { target_validity_days_override: input.validityDaysOverride }
      : {}),
    ...(input.gracePeriodDays != null
      ? { target_grace_period_days: input.gracePeriodDays }
      : {}),
    ...(input.notes ? { target_notes: input.notes } : {}),
  };
}

async function resolveRequirementMutation(input: RequirementMutationInput) {
  const curriculumId = input.curriculumId.trim();
  const versionId = input.versionId.trim();
  if (!curriculumId || !versionId) {
    return { error: "Choose a curriculum draft to update." };
  }

  const target = resolveTrainingRequirementTarget({
    courseId: input.courseId,
    applicabilityMode: input.applicabilityMode,
    ...(input.jobFunctionId != null
      ? { jobFunctionId: input.jobFunctionId }
      : {}),
    ...(input.organisationalUnitId != null
      ? { organisationalUnitId: input.organisationalUnitId }
      : {}),
  });
  if (!target.ok) {
    return { error: target.message };
  }

  const requiredWithin = optionalPositiveInteger(input.requiredWithinDays);
  if (!requiredWithin.ok) {
    return {
      error:
        "Completion deadline must be blank or a positive whole number of days.",
    };
  }

  const validityOverride = optionalPositiveInteger(input.validityDaysOverride);
  if (!validityOverride.ok) {
    return {
      error:
        "Validity override must be blank or a positive whole number of days.",
    };
  }

  const gracePeriod = optionalNonNegativeInteger(input.gracePeriodDays);
  if (!gracePeriod.ok) {
    return { error: gracePeriod.message };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: loadError } = await supabase
    .from("training_requirements")
    .select(
      "id, course_id, applies_to_all_members, job_function_id, organisational_unit_id",
    )
    .eq("curriculum_version_id", versionId);

  if (loadError) {
    return {
      error: toTrainingCurriculumErrorMessage(
        loadError,
        "Unable to save this requirement. Your entries were kept so you can try again.",
      ),
    };
  }

  const overlap = findOverlappingTrainingRequirement(
    {
      ...(input.requirementId ? { id: input.requirementId } : {}),
      courseId: target.value.courseId,
      appliesToAllMembers: target.value.appliesToAllMembers,
      jobFunctionId: target.value.jobFunctionId,
      organisationalUnitId: target.value.organisationalUnitId,
    },
    (existing ?? []).map((requirement) => ({
      id: requirement.id,
      courseId: requirement.course_id,
      appliesToAllMembers: requirement.applies_to_all_members,
      jobFunctionId: requirement.job_function_id,
      organisationalUnitId: requirement.organisational_unit_id,
    })),
  );

  if (overlap) {
    return {
      error:
        "This course already has the same applicability on this draft. Edit the existing requirement instead.",
    };
  }

  return {
    curriculumId,
    versionId,
    target: target.value,
    mandatory: input.mandatory !== false,
    requiredWithinDays: requiredWithin.value,
    validityDaysOverride: validityOverride.value,
    gracePeriodDays: gracePeriod.value,
    notes: input.notes?.trim() || undefined,
    supabase,
  };
}

export async function createTrainingCurriculumDraft(input: {
  name: string;
  code: string;
  description?: string;
}) {
  const denied = await requireTrainingCurriculumManage();
  if (denied) {
    return denied;
  }

  const name = input.name.trim();
  if (!name) {
    return { error: "Enter a curriculum name." };
  }
  if (name.length > 160) {
    return { error: "Curriculum name must be 160 characters or fewer." };
  }

  const codeResult = validateTrainingCurriculumCode(input.code);
  if (!codeResult.ok) {
    return { error: codeResult.message };
  }

  const description = input.description?.trim() || undefined;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_training_curriculum_draft",
    {
      target_name: name,
      target_code: codeResult.normalised,
      ...(description ? { target_description: description } : {}),
    },
  );

  if (error) {
    return {
      error: toTrainingCurriculumErrorMessage(
        error,
        "Unable to create this curriculum. Check the details and try again.",
      ),
    };
  }

  revalidateTrainingCurriculum(data as string);
  return { curriculumId: data as string };
}

export async function addTrainingRequirement(
  input: RequirementMutationInput,
): Promise<CurriculumActionError | { requirementId: string }> {
  const denied = await requireTrainingCurriculumManage();
  if (denied) {
    return denied;
  }

  const resolved = await resolveRequirementMutation(input);
  if ("error" in resolved) {
    return { error: resolved.error };
  }

  const { error, data } = await resolved.supabase.rpc(
    "add_training_requirement",
    {
      target_curriculum_version_id: resolved.versionId,
      ...buildRequirementRpcArgs({
        courseId: resolved.target.courseId,
        appliesToAllMembers: resolved.target.appliesToAllMembers,
        jobFunctionId: resolved.target.jobFunctionId,
        organisationalUnitId: resolved.target.organisationalUnitId,
        mandatory: resolved.mandatory,
        requiredWithinDays: resolved.requiredWithinDays,
        validityDaysOverride: resolved.validityDaysOverride,
        gracePeriodDays: resolved.gracePeriodDays,
        ...(resolved.notes ? { notes: resolved.notes } : {}),
      }),
    },
  );

  if (error) {
    return {
      error: toTrainingCurriculumErrorMessage(
        error,
        "Unable to save this requirement. Your entries were kept so you can try again.",
      ),
    };
  }

  revalidateTrainingCurriculum(resolved.curriculumId);
  return { requirementId: data as string };
}

export async function updateTrainingRequirement(
  input: RequirementMutationInput & { requirementId: string },
): Promise<CurriculumActionError | { ok: true }> {
  const denied = await requireTrainingCurriculumManage();
  if (denied) {
    return denied;
  }

  const requirementId = input.requirementId.trim();
  if (!requirementId) {
    return { error: "Choose a requirement to update." };
  }

  const resolved = await resolveRequirementMutation({
    ...input,
    requirementId,
  });
  if ("error" in resolved) {
    return { error: resolved.error };
  }

  const { error } = await resolved.supabase.rpc("update_training_requirement", {
    target_requirement_id: requirementId,
    ...buildRequirementRpcArgs({
      courseId: resolved.target.courseId,
      appliesToAllMembers: resolved.target.appliesToAllMembers,
      jobFunctionId: resolved.target.jobFunctionId,
      organisationalUnitId: resolved.target.organisationalUnitId,
      mandatory: resolved.mandatory,
      requiredWithinDays: resolved.requiredWithinDays,
      validityDaysOverride: resolved.validityDaysOverride,
      gracePeriodDays: resolved.gracePeriodDays,
      ...(resolved.notes ? { notes: resolved.notes } : {}),
    }),
  });

  if (error) {
    return {
      error: toTrainingCurriculumErrorMessage(
        error,
        "Unable to save this requirement. Your entries were kept so you can try again.",
      ),
    };
  }

  revalidateTrainingCurriculum(resolved.curriculumId);
  return { ok: true as const };
}

export async function removeTrainingRequirement(input: {
  curriculumId: string;
  requirementId: string;
}) {
  const denied = await requireTrainingCurriculumManage();
  if (denied) {
    return denied;
  }

  const curriculumId = input.curriculumId.trim();
  const requirementId = input.requirementId.trim();
  if (!curriculumId || !requirementId) {
    return { error: "Choose a requirement to remove." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_training_requirement", {
    target_requirement_id: requirementId,
  });

  if (error) {
    return {
      error: toTrainingCurriculumErrorMessage(
        error,
        "Unable to remove this requirement. Try again.",
      ),
    };
  }

  revalidateTrainingCurriculum(curriculumId);
  return { ok: true as const };
}

export async function publishTrainingCurriculumVersion(input: {
  curriculumId: string;
  versionId: string;
}) {
  const denied = await requireTrainingCurriculumManage();
  if (denied) {
    return denied;
  }

  const curriculumId = input.curriculumId.trim();
  const versionId = input.versionId.trim();
  if (!curriculumId || !versionId) {
    return { error: "Choose a curriculum draft to publish." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_training_curriculum_version", {
    target_curriculum_version_id: versionId,
  });

  if (error) {
    return {
      error: toTrainingCurriculumErrorMessage(
        error,
        "Unable to publish this curriculum. Try again.",
      ),
    };
  }

  revalidateTrainingCurriculum(curriculumId);
  return { ok: true as const };
}

export async function createCurriculumSuccessorVersion(curriculumId: string) {
  const denied = await requireTrainingCurriculumManage();
  if (denied) {
    return denied;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_training_curriculum_successor_version",
    {
      target_curriculum_id: curriculumId,
    },
  );
  if (error) {
    return {
      error: toTrainingCurriculumErrorMessage(
        error,
        "Unable to create a successor draft for this curriculum.",
      ),
    };
  }
  revalidateTrainingCurriculum(curriculumId);
  return { versionId: data as string };
}

export async function createCurriculumSuccessorFromForm(formData: FormData) {
  const curriculumId = String(formData.get("curriculumId") ?? "").trim();
  const result = await createCurriculumSuccessorVersion(curriculumId);
  if ("error" in result) {
    throw new Error(result.error);
  }
  redirect(
    buildAuthoringSavedRedirectPath(
      `/platform/training/curriculum/${curriculumId}`,
      "successor",
    ),
  );
}
