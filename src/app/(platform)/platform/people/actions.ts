"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function recordSkillValidation(input: {
  membershipId: string;
  skillId: string;
  proficiencyScaleVersionId: string;
  proficiencyLevelId: string;
  assessmentMethod?: string;
  notes?: string;
  validUntil?: string;
  organisationalUnitId?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("record_skill_validation", {
    target_membership_id: input.membershipId,
    target_skill_id: input.skillId,
    target_proficiency_scale_version_id: input.proficiencyScaleVersionId,
    target_proficiency_level_id: input.proficiencyLevelId,
    target_assessment_method: input.assessmentMethod ?? "manager_assessment",
    ...(input.notes ? { target_notes: input.notes } : {}),
    ...(input.validUntil ? { target_valid_until: input.validUntil } : {}),
    ...(input.organisationalUnitId
      ? { target_organisational_unit_id: input.organisationalUnitId }
      : {}),
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/people/${input.membershipId}`);
  revalidatePath("/platform/skills/matrix");
  return { assessmentId: data as string };
}

export async function recordSkillSelfAssessment(input: {
  membershipId: string;
  skillId: string;
  proficiencyScaleVersionId: string;
  proficiencyLevelId: string;
  notes?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("record_skill_self_assessment", {
    target_membership_id: input.membershipId,
    target_skill_id: input.skillId,
    target_proficiency_scale_version_id: input.proficiencyScaleVersionId,
    target_proficiency_level_id: input.proficiencyLevelId,
    ...(input.notes ? { target_notes: input.notes } : {}),
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/people/${input.membershipId}`);
  return { assessmentId: data as string };
}

export async function initiateSkillAssessmentEvidence(
  assessmentId: string,
  filename: string,
  mimeType: string,
  byteSize: number,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("initiate_attachment_upload", {
    target_resource_id: assessmentId,
    target_filename: filename,
    target_mime_type: mimeType,
    target_byte_size: byteSize,
  });
  if (error) return { error: error.message };
  const row = (
    data as Array<{ attachment_id: string; storage_object_path: string }>
  )[0];
  if (!row) return { error: "Upload initiation failed" };
  return {
    attachmentId: row.attachment_id,
    storagePath: row.storage_object_path,
  };
}

export async function confirmSkillAssessmentEvidence(attachmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
