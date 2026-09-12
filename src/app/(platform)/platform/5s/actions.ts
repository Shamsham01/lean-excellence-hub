"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readApplicableUnitIds } from "@/modules/operational/five-s-applicability";
import {
  loadTemplateAuthoringChildren,
  nextQuestionPosition,
} from "@/modules/operational/template-authoring";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function throwIfActionError(result: { error?: string }) {
  if (result.error) {
    throw new Error(result.error);
  }
}

async function loadFiveSDraftTemplateVersionId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  versionId: string,
) {
  const { data, error } = await supabase
    .from("five_s_standard_versions")
    .select("template_version_id, status")
    .eq("id", versionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.status !== "draft" || !data.template_version_id) {
    throw new Error("5S standard version is not editable");
  }

  return data.template_version_id;
}

export async function setFiveSStandardApplicableUnits(
  standardId: string,
  unitIds: string[],
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_five_s_standard_applicable_units", {
    target_standard_id: standardId,
    target_unit_ids: unitIds,
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/5s");
  revalidatePath(`/platform/5s/standards/${standardId}`);
  return { ok: true };
}

export async function createFiveSStandard(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const applicableUnitIds = readApplicableUnitIds(formData);
  if (!name) {
    return { error: "Name is required" };
  }
  if (applicableUnitIds.length === 0) {
    return { error: "Select at least one applicable area" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_five_s_standard_draft",
    description
      ? {
          target_display_name: name,
          target_description: description,
          target_threshold_percent: Number(formData.get("threshold") ?? 90),
        }
      : {
          target_display_name: name,
          target_threshold_percent: Number(formData.get("threshold") ?? 90),
        },
  );

  if (error) return { error: error.message };
  const standardId = data as string;
  const applicability = await setFiveSStandardApplicableUnits(
    standardId,
    applicableUnitIds,
  );
  if (applicability.error) return { error: applicability.error };
  return { standardId };
}

export async function setFiveSStandardApplicableUnitsFromForm(
  formData: FormData,
) {
  const standardId = String(formData.get("standardId") ?? "").trim();
  const applicableUnitIds = readApplicableUnitIds(formData);
  if (!standardId) {
    throw new Error("Standard is required");
  }
  const result = await setFiveSStandardApplicableUnits(
    standardId,
    applicableUnitIds,
  );
  if (result.error) {
    throw new Error(result.error);
  }
}

export async function addFiveSSection(
  versionId: string,
  title: string,
  position: number,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_five_s_section", {
    target_standard_version_id: versionId,
    target_title: title,
    target_position: position,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function addFiveSQuestion(
  versionId: string,
  sectionId: string,
  prompt: string,
  position: number,
  questionType: string,
) {
  const supabase = await createServerSupabaseClient();
  const contributesToScore =
    questionType === "score" || questionType === "yes_no";
  const rpcArgs: {
    target_standard_version_id: string;
    target_section_id: string;
    target_question_type: string;
    target_prompt: string;
    target_position: number;
    target_contributes_to_score?: boolean;
    target_scoring_metadata?: Json;
  } = {
    target_standard_version_id: versionId,
    target_section_id: sectionId,
    target_question_type: questionType,
    target_prompt: prompt,
    target_position: position,
  };

  if (contributesToScore) {
    rpcArgs.target_contributes_to_score = true;
    if (questionType === "yes_no") {
      rpcArgs.target_scoring_metadata = {
        type: "yes_no",
        yes_value: 100,
        no_value: 0,
      };
    } else if (questionType === "score") {
      rpcArgs.target_scoring_metadata = { type: "direct" };
    }
  }

  const { error } = await supabase.rpc("add_five_s_question", rpcArgs);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function publishFiveSStandard(
  versionId: string,
  standardId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_five_s_standard_version", {
    target_standard_version_id: versionId,
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/5s");
  revalidatePath(`/platform/5s/standards/${standardId}`);
  return { ok: true };
}

export async function startFiveSAudit(
  standardId: string,
  unitId: string,
  occurrenceId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_standard_id: string;
    target_unit_id: string;
    target_schedule_occurrence_id?: string;
  } = {
    target_standard_id: standardId,
    target_unit_id: unitId,
  };
  if (occurrenceId) {
    rpcArgs.target_schedule_occurrence_id = occurrenceId;
  }

  const { data, error } = await supabase.rpc("start_five_s_audit", rpcArgs);
  if (error) return { error: error.message };
  return { auditId: data as string };
}

export async function saveFiveSAuditAnswer(
  auditId: string,
  questionId: string,
  payload: {
    isNotApplicable?: boolean;
    textValue?: string | null;
    numberValue?: number | null;
  },
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_audit_id: string;
    target_question_id: string;
    target_is_not_applicable?: boolean;
    target_text_value?: string;
    target_number_value?: number;
  } = {
    target_audit_id: auditId,
    target_question_id: questionId,
  };

  if (payload.isNotApplicable) {
    rpcArgs.target_is_not_applicable = true;
  }
  if (payload.textValue != null) {
    rpcArgs.target_text_value = payload.textValue;
  }
  if (payload.numberValue != null) {
    rpcArgs.target_number_value = payload.numberValue;
  }

  const { error } = await supabase.rpc("upsert_five_s_audit_answer", rpcArgs);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function completeFiveSAudit(auditId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("complete_five_s_audit", {
    target_audit_id: auditId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/5s/audits/${auditId}`);
  revalidatePath("/platform/5s");
  return { ok: true };
}

export async function createFiveSFinding(
  auditId: string,
  observation: string,
  sectionId?: string,
  questionId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_audit_id: string;
    target_observation: string;
    target_action_required?: boolean;
    target_section_id?: string;
    target_question_id?: string;
  } = {
    target_audit_id: auditId,
    target_observation: observation,
    target_action_required: true,
  };
  if (sectionId) {
    rpcArgs.target_section_id = sectionId;
  }
  if (questionId) {
    rpcArgs.target_question_id = questionId;
  }

  const { data, error } = await supabase.rpc("create_five_s_finding", rpcArgs);
  if (error) return { error: error.message };
  return { findingId: data as string };
}

export async function createFiveSAction(
  auditId: string,
  title: string,
  description?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_title: string;
    target_audit_id: string;
    target_description?: string;
  } = {
    target_title: title,
    target_audit_id: auditId,
  };
  if (description) {
    rpcArgs.target_description = description;
  }

  const { data, error } = await supabase.rpc("create_five_s_action", rpcArgs);
  if (error) return { error: error.message };
  return { actionId: data as string };
}

export async function startFiveSAuditFromForm(formData: FormData) {
  const standardId = String(formData.get("standardId"));
  const unitId = String(formData.get("unitId"));
  const result = await startFiveSAudit(standardId, unitId);
  if (result.error) return;
  if (result.auditId) redirect(`/platform/5s/audits/${result.auditId}`);
}

export async function addFiveSSectionFromForm(formData: FormData) {
  const versionId = String(formData.get("versionId"));
  const title = String(formData.get("sectionTitle") ?? "").trim();
  const standardId = String(formData.get("standardId"));
  if (!title) {
    throw new Error("Category name is required");
  }

  const supabase = await createServerSupabaseClient();
  const templateVersionId = await loadFiveSDraftTemplateVersionId(
    supabase,
    versionId,
  );
  const authoring = await loadTemplateAuthoringChildren(
    supabase,
    templateVersionId,
  );
  const result = await addFiveSSection(
    versionId,
    title,
    authoring.nextSectionPosition,
  );
  throwIfActionError(result);
  revalidatePath(`/platform/5s/standards/${standardId}`);
}

export async function addFiveSQuestionFromForm(formData: FormData) {
  const versionId = String(formData.get("versionId"));
  const sectionId = String(formData.get("sectionId"));
  const prompt = String(formData.get("prompt") ?? "").trim();
  const questionType = String(formData.get("questionType"));
  const standardId = String(formData.get("standardId"));
  if (!prompt) {
    throw new Error("Question prompt is required");
  }

  const supabase = await createServerSupabaseClient();
  const templateVersionId = await loadFiveSDraftTemplateVersionId(
    supabase,
    versionId,
  );
  const authoring = await loadTemplateAuthoringChildren(
    supabase,
    templateVersionId,
  );
  const section = authoring.sections.find((item) => item.id === sectionId);
  if (!section) {
    throw new Error("5S category was not found");
  }

  const result = await addFiveSQuestion(
    versionId,
    sectionId,
    prompt,
    nextQuestionPosition(section),
    questionType,
  );
  throwIfActionError(result);
  revalidatePath(`/platform/5s/standards/${standardId}`);
}

export async function publishFiveSStandardFromForm(formData: FormData) {
  const versionId = String(formData.get("versionId"));
  const standardId = String(formData.get("standardId"));
  const result = await publishFiveSStandard(versionId, standardId);
  throwIfActionError(result);
}

export async function completeFiveSAuditFromForm(formData: FormData) {
  const auditId = String(formData.get("auditId"));
  await completeFiveSAudit(auditId);
  redirect(`/platform/5s/audits/${auditId}`);
}

export async function initiateFiveSEvidenceUpload(
  auditId: string,
  filename: string,
  mimeType: string,
  byteSize: number,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("initiate_attachment_upload", {
    target_resource_id: auditId,
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

export async function confirmFiveSEvidenceUpload(attachmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function linkFiveSEvidence(
  auditId: string,
  attachmentId: string,
  sectionId?: string,
  questionId?: string,
  findingId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_audit_id: string;
    target_attachment_id: string;
    target_section_id?: string;
    target_question_id?: string;
    target_finding_id?: string;
  } = {
    target_audit_id: auditId,
    target_attachment_id: attachmentId,
  };
  if (sectionId) rpcArgs.target_section_id = sectionId;
  if (questionId) rpcArgs.target_question_id = questionId;
  if (findingId) rpcArgs.target_finding_id = findingId;

  const { error } = await supabase.rpc("link_five_s_evidence", rpcArgs);
  if (error) return { error: error.message };
  revalidatePath(`/platform/5s/audits/${auditId}`);
  return { ok: true };
}

export async function createFiveSStandardSuccessor(standardId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_five_s_standard_successor_version",
    {
      target_standard_id: standardId,
    },
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/5s/standards/${standardId}`);
  return { versionId: data as string };
}

export async function createFiveSStandardSuccessorFromForm(formData: FormData) {
  const standardId = String(formData.get("standardId"));
  const result = await createFiveSStandardSuccessor(standardId);
  if (result.error) {
    throw new Error(result.error);
  }
  redirect(`/platform/5s/standards/${standardId}`);
}
