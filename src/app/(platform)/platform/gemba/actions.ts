"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function createGembaDefinition(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) {
    return { error: "Name is required" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_gemba_definition_draft",
    description
      ? { target_display_name: name, target_description: description }
      : { target_display_name: name },
  );
  if (error) return { error: error.message };
  return { definitionId: data as string };
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
  payload: { textValue?: string | null },
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_walk_id: string;
    target_question_id: string;
    target_text_value?: string;
  } = {
    target_walk_id: walkId,
    target_question_id: questionId,
  };
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
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_gemba_observation", {
    target_walk_id: walkId,
    target_observation_text: text,
    target_observation_type: observationType,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return { observationId: data as string };
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
  await addGembaSection(
    String(formData.get("versionId")),
    String(formData.get("sectionTitle")),
    Number(formData.get("position") ?? 1),
  );
  revalidatePath(`/platform/gemba/definitions/${formData.get("definitionId")}`);
}

export async function completeGembaWalkFromForm(formData: FormData) {
  await completeGembaWalk(String(formData.get("walkId")));
}

export async function createGembaObservationFromForm(formData: FormData) {
  await createGembaObservation(
    String(formData.get("walkId")),
    String(formData.get("text")),
    String(formData.get("observationType")),
  );
}

export async function publishGembaDefinitionFromForm(formData: FormData) {
  await publishGembaDefinition(
    String(formData.get("versionId")),
    String(formData.get("definitionId")),
  );
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
