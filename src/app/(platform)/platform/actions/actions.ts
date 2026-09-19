"use server";

import { revalidatePath } from "next/cache";

import { mapActionMutationError } from "@/lib/actions/errors";
import { callActionRpc } from "@/lib/actions/supabase-untyped";
import { ACTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ActionResult = { error?: string; ok?: true; id?: string };

function revalidateActionPaths(actionId?: string, suggestionId?: string) {
  revalidatePath("/platform/actions");
  revalidatePath("/platform");
  if (actionId) {
    revalidatePath(`/platform/actions/${actionId}`);
  }
  if (suggestionId) {
    revalidatePath(`/platform/suggestions/${suggestionId}`);
  }
}

export async function createAction(formData: FormData): Promise<ActionResult> {
  const canCreate = await currentMemberHasPermission(
    ACTIONS_PERMISSIONS.create,
  );
  if (!canCreate) {
    return { error: "You do not have permission to create actions." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { error: "Title is required." };
  }

  const supabase = await createServerSupabaseClient();
  const description = String(formData.get("description") ?? "").trim();
  const { data, error } = await supabase.rpc("create_action", {
    target_title: title,
    ...(description ? { target_description: description } : {}),
    target_priority: "normal",
  });

  if (error) return { error: mapActionMutationError(error) };

  const id = data as string;
  revalidateActionPaths(id);
  return { ok: true, id };
}

export async function updateActionFields(input: {
  actionId: string;
  title: string;
  description: string;
  priority: string;
  dueAt: string | null;
  expectedVersion: number;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) {
    return { error: "Title is required." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(supabase, "update_action", {
    target_action_id: input.actionId,
    target_title: title,
    target_description: input.description.trim(),
    target_priority: input.priority,
    ...(input.dueAt
      ? { target_due_at: input.dueAt, target_clear_due_at: false }
      : { target_clear_due_at: true }),
    target_expected_version: input.expectedVersion,
  });

  if (error) return { error: mapActionMutationError(error) };

  revalidateActionPaths(input.actionId);
  return { ok: true };
}

export async function setActionAssignee(input: {
  actionId: string;
  membershipId: string | null;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(supabase, "set_action_assignee", {
    target_action_id: input.actionId,
    target_membership_id: input.membershipId,
  });

  if (error) return { error: mapActionMutationError(error) };

  revalidateActionPaths(input.actionId);
  return { ok: true };
}

export async function transitionActionStatus(input: {
  actionId: string;
  toStatus: string;
  reason?: string;
  expectedVersion: number;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(supabase, "transition_action_status", {
    target_action_id: input.actionId,
    target_to_status: input.toStatus,
    ...(input.reason ? { target_reason: input.reason } : {}),
    target_expected_version: input.expectedVersion,
  });

  if (error) return { error: mapActionMutationError(error) };

  revalidateActionPaths(input.actionId);
  return { ok: true };
}

export async function completeAction(input: {
  actionId: string;
  expectedVersion: number;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(supabase, "complete_action", {
    target_action_id: input.actionId,
    target_expected_version: input.expectedVersion,
  });

  if (error) return { error: mapActionMutationError(error) };

  revalidateActionPaths(input.actionId);
  return { ok: true };
}

export async function reopenAction(input: {
  actionId: string;
  expectedVersion: number;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(supabase, "reopen_action", {
    target_action_id: input.actionId,
    target_expected_version: input.expectedVersion,
  });

  if (error) return { error: mapActionMutationError(error) };

  revalidateActionPaths(input.actionId);
  return { ok: true };
}

export async function initiateActionEvidenceUpload(
  actionId: string,
  filename: string,
  mimeType: string,
  byteSize: number,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("initiate_attachment_upload", {
    target_resource_id: actionId,
    target_filename: filename,
    target_mime_type: mimeType,
    target_byte_size: byteSize,
  });

  if (error) return { error: mapActionMutationError(error) };

  const row = (
    data as Array<{ attachment_id: string; storage_object_path: string }>
  )[0];

  if (!row) return { error: "Upload initiation failed" };

  return {
    attachmentId: row.attachment_id,
    storagePath: row.storage_object_path,
  };
}

export async function confirmActionEvidenceUpload(
  actionId: string,
  attachmentId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });

  if (error) return { error: mapActionMutationError(error) };

  revalidateActionPaths(actionId);
  return {};
}
