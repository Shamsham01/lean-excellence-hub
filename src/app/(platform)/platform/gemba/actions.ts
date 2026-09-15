"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readApplicableUnitIds } from "@/modules/operational/gemba-applicability";
import {
  loadTemplateAuthoringChildren,
  nextQuestionPosition,
} from "@/modules/operational/template-authoring";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function throwIfActionError(result: { error?: string }) {
  if (result.error) {
    throw new Error(result.error);
  }
}

async function loadGembaDraftTemplateVersionId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  versionId: string,
) {
  const { data, error } = await supabase
    .from("gemba_definition_versions")
    .select("template_version_id, status")
    .eq("id", versionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.status !== "draft" || !data.template_version_id) {
    throw new Error("gemba definition version is not editable");
  }

  return data.template_version_id;
}

export async function setGembaDefinitionApplicableUnits(
  definitionId: string,
  unitIds: string[],
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(
    "set_gemba_definition_applicable_units",
    {
      target_definition_id: definitionId,
      target_unit_ids: unitIds,
    },
  );
  if (error) return { error: error.message };
  revalidatePath("/platform/gemba");
  revalidatePath(`/platform/gemba/definitions/${definitionId}`);
  return { ok: true };
}

export async function createGembaDefinition(formData: FormData) {
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
  const { data, error } = await supabase.rpc("create_gemba_definition_draft", {
    target_display_name: name,
    ...(description ? { target_description: description } : {}),
    target_unit_ids: applicableUnitIds,
  });
  if (error) return { error: error.message };
  return { definitionId: data as string };
}

export async function setGembaDefinitionApplicableUnitsFromForm(
  formData: FormData,
) {
  const definitionId = String(formData.get("definitionId") ?? "").trim();
  const applicableUnitIds = readApplicableUnitIds(formData);
  if (!definitionId) {
    throw new Error("Definition is required");
  }
  const result = await setGembaDefinitionApplicableUnits(
    definitionId,
    applicableUnitIds,
  );
  if (result.error) {
    throw new Error(result.error);
  }
}

export async function addGembaSection(
  versionId: string,
  title: string,
  position: number,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_gemba_section", {
    target_definition_version_id: versionId,
    target_title: title,
    target_position: position,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function addGembaQuestion(
  versionId: string,
  sectionId: string,
  prompt: string,
  position: number,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_gemba_question", {
    target_definition_version_id: versionId,
    target_section_id: sectionId,
    target_question_type: "short_text",
    target_prompt: prompt,
    target_position: position,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function publishGembaDefinition(
  versionId: string,
  definitionId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_gemba_definition_version", {
    target_definition_version_id: versionId,
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/gemba");
  revalidatePath(`/platform/gemba/definitions/${definitionId}`);
  return { ok: true };
}

export async function startGembaWalk(
  definitionId: string,
  unitId: string,
  occurrenceId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_definition_id: string;
    target_unit_id: string;
    target_schedule_occurrence_id?: string;
  } = {
    target_definition_id: definitionId,
    target_unit_id: unitId,
  };
  if (occurrenceId) {
    rpcArgs.target_schedule_occurrence_id = occurrenceId;
  }

  const { data, error } = await supabase.rpc("start_gemba_walk", rpcArgs);
  if (error) return { error: error.message };
  return { walkId: data as string };
}

export async function startGembaWalkFromForm(formData: FormData) {
  const definitionId = String(formData.get("definitionId"));
  const unitId = String(formData.get("unitId"));
  const result = await startGembaWalk(definitionId, unitId);
  if (result.walkId) redirect(`/platform/gemba/walks/${result.walkId}`);
}

export async function saveGembaWalkAnswer(
  walkId: string,
  questionId: string,
  payload: { textValue?: string | null; isNotApplicable?: boolean },
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_walk_id: string;
    target_question_id: string;
    target_text_value?: string;
    target_is_not_applicable?: boolean;
  } = {
    target_walk_id: walkId,
    target_question_id: questionId,
  };
  if (payload.isNotApplicable) {
    rpcArgs.target_is_not_applicable = true;
  }
  if (payload.textValue != null) {
    rpcArgs.target_text_value = payload.textValue;
  }

  const { error } = await supabase.rpc("upsert_gemba_walk_answer", rpcArgs);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function createGembaObservation(
  walkId: string,
  text: string,
  observationType: string,
  clientRequestId?: string,
) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Enter observation text before saving." };
  }

  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_walk_id: string;
    target_observation_text: string;
    target_observation_type: string;
    target_client_request_id?: string;
  } = {
    target_walk_id: walkId,
    target_observation_text: trimmed,
    target_observation_type: observationType,
  };
  if (clientRequestId) {
    rpcArgs.target_client_request_id = clientRequestId;
  }

  const { data, error } = await supabase.rpc(
    "create_gemba_observation",
    rpcArgs,
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return { observationId: data as string };
}

export async function updateGembaObservation(
  walkId: string,
  observationId: string,
  text: string,
  observationType: string,
) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Enter observation text before saving." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_gemba_observation", {
    target_walk_id: walkId,
    target_observation_id: observationId,
    target_observation_text: trimmed,
    target_observation_type: observationType,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return { ok: true };
}

export async function deleteGembaObservation(
  walkId: string,
  observationId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_gemba_observation", {
    target_walk_id: walkId,
    target_observation_id: observationId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return { ok: true };
}

export async function deleteGembaObservations(
  walkId: string,
  observationIds: string[],
) {
  if (observationIds.length === 0) {
    return { error: "Select at least one observation to delete." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_gemba_observations", {
    target_walk_id: walkId,
    target_observation_ids: observationIds,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return { ok: true };
}

export async function completeGembaWalk(walkId: string, summary?: string) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: { target_walk_id: string; target_summary_notes?: string } = {
    target_walk_id: walkId,
  };
  if (summary) {
    rpcArgs.target_summary_notes = summary;
  }

  const { error } = await supabase.rpc("complete_gemba_walk", rpcArgs);
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  revalidatePath("/platform/gemba");
  return { ok: true };
}

export async function addGembaSectionFromForm(formData: FormData) {
  const versionId = String(formData.get("versionId"));
  const title = String(formData.get("sectionTitle") ?? "").trim();
  const definitionId = String(formData.get("definitionId"));
  if (!title) {
    throw new Error("Section title is required");
  }

  const supabase = await createServerSupabaseClient();
  const templateVersionId = await loadGembaDraftTemplateVersionId(
    supabase,
    versionId,
  );
  const authoring = await loadTemplateAuthoringChildren(
    supabase,
    templateVersionId,
  );
  const result = await addGembaSection(
    versionId,
    title,
    authoring.nextSectionPosition,
  );
  throwIfActionError(result);
  revalidatePath(`/platform/gemba/definitions/${definitionId}`);
}

export async function addGembaQuestionFromForm(formData: FormData) {
  const versionId = String(formData.get("versionId"));
  const sectionId = String(formData.get("sectionId"));
  const prompt = String(formData.get("prompt") ?? "").trim();
  const definitionId = String(formData.get("definitionId"));
  if (!prompt) {
    throw new Error("Walk prompt is required");
  }

  const supabase = await createServerSupabaseClient();
  const templateVersionId = await loadGembaDraftTemplateVersionId(
    supabase,
    versionId,
  );
  const authoring = await loadTemplateAuthoringChildren(
    supabase,
    templateVersionId,
  );
  const section = authoring.sections.find((item) => item.id === sectionId);
  if (!section) {
    throw new Error("gemba section was not found");
  }

  const result = await addGembaQuestion(
    versionId,
    sectionId,
    prompt,
    nextQuestionPosition(section),
  );
  throwIfActionError(result);
  revalidatePath(`/platform/gemba/definitions/${definitionId}`);
}

export async function completeGembaWalkFromForm(formData: FormData) {
  await completeGembaWalk(String(formData.get("walkId")));
}

export async function createGembaObservationFromForm(formData: FormData) {
  const result = await createGembaObservation(
    String(formData.get("walkId")),
    String(formData.get("text") ?? ""),
    String(formData.get("observationType")),
  );
  if (result.error) {
    throw new Error(result.error);
  }
}

export async function publishGembaDefinitionFromForm(formData: FormData) {
  const result = await publishGembaDefinition(
    String(formData.get("versionId")),
    String(formData.get("definitionId")),
  );
  throwIfActionError(result);
}

export async function initiateGembaEvidenceUpload(
  walkId: string,
  filename: string,
  mimeType: string,
  byteSize: number,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("initiate_attachment_upload", {
    target_resource_id: walkId,
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

export async function confirmGembaEvidenceUpload(attachmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function linkGembaEvidence(
  walkId: string,
  attachmentId: string,
  sectionId?: string,
  questionId?: string,
  observationId?: string,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_walk_id: string;
    target_attachment_id: string;
    target_section_id?: string;
    target_question_id?: string;
    target_observation_id?: string;
  } = {
    target_walk_id: walkId,
    target_attachment_id: attachmentId,
  };
  if (sectionId) rpcArgs.target_section_id = sectionId;
  if (questionId) rpcArgs.target_question_id = questionId;
  if (observationId) rpcArgs.target_observation_id = observationId;

  const { error } = await supabase.rpc("link_gemba_evidence", rpcArgs);
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return { ok: true };
}

export async function createGembaDefinitionSuccessor(definitionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_gemba_definition_successor_version",
    {
      target_definition_id: definitionId,
    },
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/definitions/${definitionId}`);
  return { versionId: data as string };
}

export async function createGembaDefinitionSuccessorFromForm(
  formData: FormData,
) {
  const definitionId = String(formData.get("definitionId"));
  const result = await createGembaDefinitionSuccessor(definitionId);
  if (result.error) {
    throw new Error(result.error);
  }
  redirect(`/platform/gemba/definitions/${definitionId}`);
}
