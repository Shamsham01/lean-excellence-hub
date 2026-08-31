"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function createMaturityModel(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) {
    return { error: "Name is required" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_maturity_model_draft",
    description
      ? { target_display_name: name, target_description: description }
      : { target_display_name: name },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/platform/maturity/models");
  return { modelId: data as string };
}

export async function publishMaturityModel(
  versionId: string,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_maturity_model_version", {
    target_model_version_id: versionId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/platform/maturity");
  if (modelId) {
    revalidatePath(`/platform/maturity/models/${modelId}`);
  }
  return { ok: true };
}

export async function startAssessment(formData: FormData) {
  const modelVersionId = String(formData.get("modelVersionId"));
  const unitId = String(formData.get("unitId"));
  const assessmentType = String(formData.get("assessmentType"));
  const assessmentScopeType = String(formData.get("assessmentScopeType"));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("start_maturity_assessment", {
    target_model_version_id: modelVersionId,
    target_unit_id: unitId,
    target_assessment_type: assessmentType,
    target_assessment_scope_type: assessmentScopeType,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/platform/maturity/assessments");
  return { assessmentId: data as string };
}

export async function setFrameworkAssessmentScopes(
  versionId: string,
  scopeTypes: string[],
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(
    "set_maturity_model_version_assessment_scopes",
    {
      target_model_version_id: versionId,
      target_scope_types: scopeTypes,
    },
  );
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  return { ok: true };
}

export async function createSuccessorVersion(modelId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_maturity_model_successor_version",
    { target_model_id: modelId },
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/models/${modelId}`);
  revalidatePath("/platform/maturity/models");
  return { versionId: data as string };
}

export async function deactivateFrameworkVersion(
  versionId: string,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_maturity_model_version", {
    target_model_version_id: versionId,
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  revalidatePath("/platform/maturity/models");
  return { ok: true };
}

export async function deleteDraftVersion(versionId: string, modelId?: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_maturity_model_draft_version", {
    target_model_version_id: versionId,
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  revalidatePath("/platform/maturity/models");
  return { ok: true };
}

export async function saveCriterionNote(
  assessmentId: string,
  criterionId: string,
  commentText: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(
    "upsert_maturity_assessment_criterion_note",
    {
      target_assessment_id: assessmentId,
      target_criterion_id: criterionId,
      target_comment_text: commentText,
    },
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function saveAssessmentAnswer(
  assessmentId: string,
  questionId: string,
  payload: {
    isNotApplicable?: boolean;
    textValue?: string | null;
    numberValue?: number | null;
  },
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_assessment_id: string;
    target_question_id: string;
    target_is_not_applicable?: boolean;
    target_text_value?: string;
    target_number_value?: number;
  } = {
    target_assessment_id: assessmentId,
    target_question_id: questionId,
    target_is_not_applicable: payload.isNotApplicable ?? false,
  };

  if (payload.textValue != null && payload.textValue !== "") {
    rpcArgs.target_text_value = payload.textValue;
  }
  if (payload.numberValue != null) {
    rpcArgs.target_number_value = payload.numberValue;
  }

  const { error } = await supabase.rpc(
    "upsert_maturity_assessment_answer",
    rpcArgs,
  );

  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function submitAssessment(assessmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("submit_maturity_assessment", {
    target_assessment_id: assessmentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function approveAssessment(assessmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("approve_maturity_assessment", {
    target_assessment_id: assessmentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function publishOfficialResult(assessmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "publish_official_maturity_result",
    {
      target_assessment_id: assessmentId,
    },
  );
  if (error) return { error: error.message };
  revalidatePath("/platform/maturity");
  return { resultId: data as string };
}

export async function completeSelfAssessment(assessmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("complete_self_assessment", {
    target_assessment_id: assessmentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function beginAssessorReview(assessmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("begin_assessor_review", {
    target_assessment_id: assessmentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function addMaturityLevel(
  versionId: string,
  levelNumber: number,
  name: string,
  colorToken: string,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_maturity_level", {
    target_model_version_id: versionId,
    target_level_number: levelNumber,
    target_name: name,
    target_color_token: colorToken,
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  return { levelId: data as string };
}

export async function addMaturityPillar(
  versionId: string,
  name: string,
  position: number,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_maturity_pillar", {
    target_model_version_id: versionId,
    target_name: name,
    target_position: position,
    target_section_title: name,
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  return { pillarId: data as string };
}

export async function addMaturityCriterion(
  pillarId: string,
  name: string,
  position: number,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_maturity_criterion", {
    target_pillar_id: pillarId,
    target_name: name,
    target_position: position,
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  return { criterionId: data as string };
}

export async function addMaturityQuestion(
  versionId: string,
  sectionId: string,
  prompt: string,
  position: number,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_maturity_question", {
    target_model_version_id: versionId,
    target_section_id: sectionId,
    target_question_type: "score",
    target_prompt: prompt,
    target_position: position,
    target_allows_not_applicable: true,
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  return { questionId: data as string };
}

export async function linkCriterionQuestion(
  criterionId: string,
  questionId: string,
  modelId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("link_criterion_question", {
    target_criterion_id: criterionId,
    target_question_id: questionId,
    target_contributes_to_score: true,
    target_scoring_metadata: { type: "direct" },
  });
  if (error) return { error: error.message };
  if (modelId) revalidatePath(`/platform/maturity/models/${modelId}`);
  return { ok: true };
}

export async function initiateEvidenceUpload(
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

export async function confirmEvidenceUpload(attachmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function linkMaturityEvidence(
  assessmentId: string,
  attachmentId: string,
  criterionId: string,
  questionId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_assessment_id: string;
    target_attachment_id: string;
    target_criterion_id: string;
    target_question_id?: string;
  } = {
    target_assessment_id: assessmentId,
    target_attachment_id: attachmentId,
    target_criterion_id: criterionId,
  };
  if (questionId) {
    rpcArgs.target_question_id = questionId;
  }
  const { error } = await supabase.rpc("link_maturity_evidence", rpcArgs);
  if (error) return { error: error.message };
  revalidatePath(`/platform/maturity/assessments/${assessmentId}`);
  return { ok: true };
}

export async function createMaturityAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const questionId = formData.get("questionId");
  const description = String(formData.get("description") || "").trim();

  const rpcArgs: {
    target_title: string;
    target_assessment_id: string;
    target_pillar_id: string;
    target_criterion_id: string;
    target_question_id?: string;
    target_description?: string;
    target_priority?: string;
  } = {
    target_title: String(formData.get("title")),
    target_assessment_id: String(formData.get("assessmentId")),
    target_pillar_id: String(formData.get("pillarId")),
    target_criterion_id: String(formData.get("criterionId")),
    target_priority: String(formData.get("priority") || "normal"),
  };

  if (questionId) {
    rpcArgs.target_question_id = String(questionId);
  }
  if (description) {
    rpcArgs.target_description = description;
  }

  const { data, error } = await supabase.rpc("create_maturity_action", rpcArgs);
  if (error) return { error: error.message };
  revalidatePath("/platform/actions");
  return { actionId: data as string };
}
