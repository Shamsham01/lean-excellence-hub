"use server";

import { revalidatePath } from "next/cache";

import { mapSuggestionReviewActionError } from "@/lib/suggestions/review-action-errors";
import { toSuggestionCatalogErrorMessage } from "@/modules/suggestions/customer-errors";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ActionResult = { error?: string; ok?: true; id?: string };

export async function submitSuggestionDraft(
  suggestionId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("submit_suggestion", {
    target_suggestion_id: suggestionId,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions");

  return { ok: true };
}

function reviewWorkflowPaths(suggestionId: string) {
  revalidatePath("/platform/suggestions");
  revalidatePath("/platform/suggestions/review");
  revalidatePath(`/platform/suggestions/${suggestionId}`);
}

function reviewActionError(error: {
  message: string;
  code?: string;
}): ActionResult {
  return { error: mapSuggestionReviewActionError(error) };
}

export async function claimSuggestionForReview(
  suggestionId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("claim_suggestion_for_review", {
    target_suggestion_id: suggestionId,
  });

  if (error) return reviewActionError(error);

  reviewWorkflowPaths(suggestionId);

  return { ok: true };
}

export async function assignSuggestionReviewer(
  suggestionId: string,
  reviewerMembershipId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("assign_suggestion_reviewer", {
    target_suggestion_id: suggestionId,
    target_reviewer_membership_id: reviewerMembershipId,
  });

  if (error) return reviewActionError(error);

  reviewWorkflowPaths(suggestionId);

  return { ok: true };
}

export async function beginSuggestionReview(
  suggestionId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("begin_suggestion_review", {
    target_suggestion_id: suggestionId,
  });

  if (error) return reviewActionError(error);

  reviewWorkflowPaths(suggestionId);

  return { ok: true };
}

export async function approveSuggestion(
  suggestionId: string,
  impactLevel: string,
  effortLevel: string,
  rationale: string,
  implementationRecommendation?: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("approve_suggestion", {
    target_suggestion_id: suggestionId,
    target_impact_level: impactLevel,
    target_effort_level: effortLevel,
    target_rationale: rationale,
    ...(implementationRecommendation
      ? { target_implementation_recommendation: implementationRecommendation }
      : {}),
  });

  if (error) return reviewActionError(error);

  reviewWorkflowPaths(suggestionId);

  return { ok: true };
}

export async function declineSuggestion(
  suggestionId: string,
  impactLevel: string,
  effortLevel: string,
  rationale: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("decline_suggestion", {
    target_suggestion_id: suggestionId,
    target_impact_level: impactLevel,
    target_effort_level: effortLevel,
    target_rationale: rationale,
  });

  if (error) return reviewActionError(error);

  reviewWorkflowPaths(suggestionId);

  return { ok: true };
}

export async function parkSuggestion(
  suggestionId: string,
  rationale: string,
  impactLevel = "medium",
  effortLevel = "medium",
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("park_suggestion", {
    target_suggestion_id: suggestionId,
    target_rationale: rationale,
    target_impact_level: impactLevel,
    target_effort_level: effortLevel,
  });

  if (error) return reviewActionError(error);

  reviewWorkflowPaths(suggestionId);

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

  reviewWorkflowPaths(suggestionId);

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

export async function createProjectFromSuggestion(
  suggestionId: string,
): Promise<ActionResult> {
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

  const { data, error } = await supabase.rpc(
    "create_suggestion_programme_draft",
    {
      target_name: input.name,

      target_code: input.code,

      ...(input.description ? { target_description: input.description } : {}),
    },
  );

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

    ...(input.displayOrder !== undefined
      ? { target_display_order: input.displayOrder }
      : {}),
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");

  revalidatePath("/platform/suggestions/new");

  return { ok: true, id: data as string };
}

export async function updateSuggestionProgramme(input: {
  programmeId: string;
  name: string;
  description?: string | null;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("update_suggestion_programme", {
    target_programme_id: input.programmeId,
    target_name: input.name,
    ...(typeof input.description === "string"
      ? { target_description: input.description }
      : {}),
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function deactivateSuggestionProgramme(
  programmeId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("deactivate_suggestion_programme", {
    target_programme_id: programmeId,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function reactivateSuggestionProgramme(
  programmeId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("reactivate_suggestion_programme", {
    target_programme_id: programmeId,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function deleteSuggestionProgrammeDraft(
  programmeId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("delete_suggestion_programme_draft", {
    target_programme_id: programmeId,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function updateSuggestionCategory(input: {
  categoryId: string;
  name?: string;
  description?: string | null;
  displayOrder?: number;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("update_suggestion_category", {
    target_category_id: input.categoryId,
    ...(input.name !== undefined ? { target_name: input.name } : {}),
    ...(typeof input.description === "string"
      ? { target_description: input.description }
      : {}),
    ...(input.displayOrder !== undefined
      ? { target_display_order: input.displayOrder }
      : {}),
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function deactivateSuggestionCategory(
  categoryId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("deactivate_suggestion_category", {
    target_category_id: categoryId,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function reactivateSuggestionCategory(
  categoryId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("reactivate_suggestion_category", {
    target_category_id: categoryId,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
}

export async function deleteSuggestionCategory(
  categoryId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("delete_suggestion_category", {
    target_category_id: categoryId,
  });

  if (error) {
    return {
      error: toSuggestionCatalogErrorMessage(
        error,
        "Unable to delete this category.",
      ),
    };
  }

  revalidatePath("/platform/suggestions/programmes");
  revalidatePath("/platform/suggestions/new");

  return { ok: true };
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
