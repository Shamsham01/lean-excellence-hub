"use server";



import { revalidatePath } from "next/cache";



import { createServerSupabaseClient } from "@/platform/supabase/server";



type ActionResult = { error?: string; ok?: true; id?: string };



export async function submitSuggestionDraft(suggestionId: string): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("submit_suggestion", {

    target_suggestion_id: suggestionId,

  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions");

  return { ok: true };

}



export async function beginSuggestionReview(suggestionId: string): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("begin_suggestion_review", {

    target_suggestion_id: suggestionId,

  });

  if (error) return { error: error.message };

  revalidatePath(`/platform/suggestions/${suggestionId}`);

  revalidatePath("/platform/suggestions/review");

  return { ok: true };

}



export async function recordSuggestionReview(

  suggestionId: string,

  decision: string,

  impactLevel: string,

  effortLevel: string,

  rationale: string,

  implementationRecommendation?: string,

): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("record_suggestion_review", {

    target_suggestion_id: suggestionId,

    target_decision: decision,

    target_impact_level: impactLevel,

    target_effort_level: effortLevel,

    target_rationale: rationale,

    ...(implementationRecommendation

      ? { target_implementation_recommendation: implementationRecommendation }

      : {}),

  });

  if (error) return { error: error.message };

  revalidatePath(`/platform/suggestions/${suggestionId}`);

  revalidatePath("/platform/suggestions");

  revalidatePath("/platform/suggestions/review");

  return { ok: true };

}



export async function createSuggestionAction(

  suggestionId: string,

  title: string,

  description?: string,

): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("create_suggestion_action", {

    target_suggestion_id: suggestionId,

    target_title: title,

    ...(description ? { target_description: description } : {}),

  });

  if (error) return { error: error.message };

  revalidatePath(`/platform/suggestions/${suggestionId}`);

  return { ok: true };

}



export async function createProjectFromSuggestion(suggestionId: string): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc(

    "create_improvement_project_from_suggestion",

    { target_suggestion_id: suggestionId },

  );

  if (error) return { error: error.message };

  revalidatePath(`/platform/suggestions/${suggestionId}`);

  return { ok: true, id: data as string };

}



export async function markSuggestionImplemented(

  suggestionId: string,

  summary: string,

  outcome = "implemented_as_proposed",

): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("mark_suggestion_implemented", {

    target_suggestion_id: suggestionId,

    target_implementation_summary: summary,

    target_implementation_outcome: outcome,

  });

  if (error) return { error: error.message };

  revalidatePath(`/platform/suggestions/${suggestionId}`);

  return { ok: true };

}



export async function createSuggestionProgrammeDraft(input: {

  name: string;

  code: string;

  description?: string;

}): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("create_suggestion_programme_draft", {

    target_name: input.name,

    target_code: input.code,

    ...(input.description ? { target_description: input.description } : {}),

  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");

  return { ok: true, id: data as string };

}



export async function updateSuggestionProgrammeVersion(input: {

  versionId: string;

  reviewTargetDays?: number | null;

  templateVersionId?: string | null;

  submissionGuidance?: string | null;

}): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase

    .from("suggestion_programme_versions")

    .update({

      ...(input.reviewTargetDays !== undefined

        ? { review_target_days: input.reviewTargetDays }

        : {}),

      ...(input.templateVersionId !== undefined

        ? { template_version_id: input.templateVersionId }

        : {}),

      ...(input.submissionGuidance !== undefined

        ? { submission_guidance: input.submissionGuidance }

        : {}),

    })

    .eq("id", input.versionId)

    .eq("lifecycle", "draft");

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");

  return { ok: true };

}



export async function publishSuggestionProgrammeVersion(

  versionId: string,

): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("publish_suggestion_programme_version", {

    target_programme_version_id: versionId,

  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");

  revalidatePath("/platform/suggestions/new");

  return { ok: true };

}



export async function createSuggestionProgrammeSuccessor(

  programmeId: string,

): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc(
    "create_suggestion_programme_successor_version",
    { target_programme_id: programmeId },
  );

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");

  return { ok: true, id: data as string };

}



export async function createSuggestionCategory(input: {

  name: string;

  code: string;

  description?: string;

  displayOrder?: number;

}): Promise<ActionResult> {

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("create_suggestion_category", {

    target_name: input.name,

    target_code: input.code,

    ...(input.description ? { target_description: input.description } : {}),

    ...(input.displayOrder !== undefined ? { target_display_order: input.displayOrder } : {}),

  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");

  revalidatePath("/platform/suggestions/new");

  return { ok: true, id: data as string };

}



export async function initiateSuggestionEvidenceUpload(

  suggestionId: string,

  filename: string,

  mimeType: string,

  byteSize: number,

) {

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("initiate_attachment_upload", {

    target_resource_id: suggestionId,

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



export async function confirmSuggestionEvidenceUpload(

  suggestionId: string,

  attachmentId: string,

) {

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("confirm_attachment_upload", {

    target_attachment_id: attachmentId,

  });

  if (error) return { error: error.message };

  revalidatePath(`/platform/suggestions/${suggestionId}`);

  return {};

}


