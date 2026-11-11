"use server";

import { revalidatePath } from "next/cache";

import type { ActionPlannerComment } from "@/components/actions/action-planner-comments";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { mapActionMutationError } from "@/lib/actions/errors";
import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type {
  ActionDetail,
  ActionLabel,
  AssignablePerson,
} from "@/lib/actions/types";
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

export async function listActionLabels(): Promise<{
  error?: string;
  labels?: ActionLabel[];
}> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await callActionRpc<ActionLabel[]>(
    supabase,
    "list_action_labels",
  );
  if (error) return { error: mapActionMutationError(error) };
  const labels = Array.isArray(data) ? data : [];
  return { labels: labels as ActionLabel[] };
}

export async function setActionLabelsForAction(
  actionId: string,
  labelIds: string[],
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(supabase, "set_action_labels", {
    target_action_id: actionId,
    target_label_ids: labelIds,
  });
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths(actionId);
  return { ok: true };
}

export async function addActionChecklistItem(
  actionId: string,
  title: string,
): Promise<ActionResult & { id?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await callActionRpc<string>(
    supabase,
    "add_action_checklist_item",
    {
      target_action_id: actionId,
      target_title: title.trim(),
    },
  );
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths(actionId);
  if (typeof data === "string" && data.length > 0) {
    return { ok: true, id: data };
  }
  return { ok: true };
}

export async function setActionChecklistItemDone(
  itemId: string,
  done: boolean,
  actionId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(
    supabase,
    "set_action_checklist_item_done",
    {
      target_item_id: itemId,
      target_done: done,
    },
  );
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths(actionId);
  return { ok: true };
}

export async function deleteActionChecklistItem(
  itemId: string,
  actionId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(
    supabase,
    "delete_action_checklist_item",
    { target_item_id: itemId },
  );
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths(actionId);
  return { ok: true };
}

export async function moveActionChecklistItem(
  itemId: string,
  sortOrder: number,
  actionId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(
    supabase,
    "move_action_checklist_item",
    {
      target_item_id: itemId,
      target_sort_order: sortOrder,
    },
  );
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths(actionId);
  return { ok: true };
}

export async function upsertActionLabel(input: {
  labelId?: string | null;
  name: string;
  color: string;
}): Promise<ActionResult & { labelId?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await callActionRpc<string>(
    supabase,
    "upsert_action_label",
    {
      ...(input.labelId ? { target_label_id: input.labelId } : {}),
      target_name: input.name.trim(),
      target_color: input.color,
    },
  );
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths();
  if (typeof data === "string" && data.length > 0) {
    return { ok: true, labelId: data };
  }
  return { ok: true };
}

export async function setActionCardCover(
  actionId: string,
  attachmentId: string | null,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callActionRpc(
    supabase,
    "set_action_card_cover_attachment",
    {
      target_action_id: actionId,
      target_attachment_id: attachmentId,
    },
  );
  if (error) return { error: mapActionMutationError(error) };
  revalidateActionPaths(actionId);
  return { ok: true };
}

export async function loadActionCreateContext(): Promise<{
  labels: ActionLabel[];
  assignablePeople: AssignablePerson[];
  canManageLabels: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const [labelsResult, canAssign, canUpdate] = await Promise.all([
    listActionLabels(),
    currentMemberHasPermission(ACTIONS_PERMISSIONS.assign),
    currentMemberHasPermission(ACTIONS_PERMISSIONS.update),
  ]);

  let assignablePeople: AssignablePerson[] = [];
  if (canAssign) {
    const { data: directory } = await supabase.rpc("get_people_directory", {
      target_page: 1,
      target_page_size: 200,
    });
    type DirectoryPayload = {
      people?: Array<{
        membership_id: string;
        display_name: string | null;
        avatar_url?: string | null;
      }>;
    };
    const people = (directory as DirectoryPayload | null)?.people ?? [];
    assignablePeople = people.map((person) => ({
      membership_id: person.membership_id,
      display_name: person.display_name?.trim() || "Team member",
      avatar_url: person.avatar_url ?? null,
    }));
  }

  return {
    labels: labelsResult.labels ?? [],
    assignablePeople,
    canManageLabels: canUpdate,
  };
}

export async function createPlannerAction(input: {
  title: string;
  description: string;
  dueAt: string | null;
  assigneeMembershipId: string | null;
  labelIds: string[];
  checklistTitles: string[];
}): Promise<ActionResult> {
  const canCreate = await currentMemberHasPermission(
    ACTIONS_PERMISSIONS.create,
  );
  if (!canCreate) {
    return { error: "You do not have permission to create actions." };
  }

  const title = input.title.trim();
  if (!title) return { error: "Title is required." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_action", {
    target_title: title,
    ...(input.description.trim()
      ? { target_description: input.description.trim() }
      : {}),
    target_priority: "normal",
    ...(input.dueAt ? { target_due_at: input.dueAt } : {}),
  });
  if (error) return { error: mapActionMutationError(error) };
  const actionId = data as string;

  if (input.assigneeMembershipId) {
    const assignResult = await setActionAssignee({
      actionId,
      membershipId: input.assigneeMembershipId,
    });
    if (assignResult.error) return assignResult;
  }

  if (input.labelIds.length > 0) {
    const labelResult = await setActionLabelsForAction(
      actionId,
      input.labelIds,
    );
    if (labelResult.error) return labelResult;
  }

  for (const checklistTitle of input.checklistTitles) {
    const trimmed = checklistTitle.trim();
    if (!trimmed) continue;
    const itemResult = await addActionChecklistItem(actionId, trimmed);
    if (itemResult.error) return itemResult;
  }

  revalidateActionPaths(actionId);
  return { ok: true, id: actionId };
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

type ActionSheetPayload = {
  detail: ActionDetail;
  comments: ActionPlannerComment[];
  legacyComments: CommentRow[];
  evidence: EvidenceItem[];
  assignablePeople: AssignablePerson[];
  canUploadEvidence: boolean;
};

export async function loadActionSheetPayload(
  actionId: string,
): Promise<{ error?: string; payload?: ActionSheetPayload }> {
  const supabase = await createServerSupabaseClient();
  const { data: detail, error } = await callActionRpc<ActionDetail>(
    supabase,
    "get_action_detail",
    { target_action_id: actionId },
  );

  if (error || !detail) {
    return {
      error: error
        ? mapActionMutationError(error)
        : "This action could not be loaded.",
    };
  }

  const canUploadEvidence =
    await currentMemberHasPermission("attachments.upload");
  const canAssign = await currentMemberHasPermission(
    ACTIONS_PERMISSIONS.assign,
  );

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_membership_id")
    .eq("target_resource_id", actionId)
    .order("created_at");

  const { data: evidence } = await supabase
    .from("attachments")
    .select("id, filename, mime_type, byte_size, storage_object_path")
    .eq("target_resource_id", actionId)
    .eq("lifecycle", "active")
    .order("created_at");

  let assignablePeople: AssignablePerson[] = [];
  if (canAssign && detail.permissions.can_assign) {
    const { data: directory } = await supabase.rpc("get_people_directory", {
      target_page: 1,
      target_page_size: 200,
    });
    type AssignDirectoryPayload = {
      people?: Array<{
        membership_id: string;
        display_name: string | null;
        avatar_url?: string | null;
      }>;
    };
    const people = (directory as AssignDirectoryPayload | null)?.people ?? [];
    assignablePeople = people.map((person) => ({
      membership_id: person.membership_id,
      display_name: person.display_name?.trim() || "Team member",
      avatar_url: person.avatar_url ?? null,
    }));

    for (const assignee of detail.assignees) {
      if (
        !assignablePeople.some(
          (person) => person.membership_id === assignee.membership_id,
        )
      ) {
        assignablePeople.push({
          membership_id: assignee.membership_id,
          display_name: assignee.display_name,
        });
      }
    }
  }

  const { data: directory } = await supabase.rpc("get_people_directory", {
    target_page: 1,
    target_page_size: 500,
  });
  type DirectoryPayload = {
    people?: Array<{
      membership_id: string;
      display_name: string | null;
      avatar_url?: string | null;
    }>;
  };
  const directoryPeople = (directory as DirectoryPayload | null)?.people ?? [];
  const peopleById = new Map(
    directoryPeople.map((person) => [person.membership_id, person]),
  );

  const enrichedComments: ActionPlannerComment[] = (comments ?? []).map(
    (row) => {
      const author = peopleById.get(row.author_membership_id);
      return {
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author_membership_id: row.author_membership_id,
        author_display_name: author?.display_name?.trim() || "Team member",
        author_avatar_url: author?.avatar_url ?? null,
      };
    },
  );

  return {
    payload: {
      detail,
      comments: enrichedComments,
      legacyComments: (comments ?? []) as CommentRow[],
      evidence: (evidence ?? [])
        .filter((item) => item.byte_size != null)
        .map((item): ActionSheetPayload["evidence"][number] => ({
          id: item.id,
          filename: item.filename,
          mime_type: item.mime_type,
          byte_size: item.byte_size as number,
          storage_object_path: item.storage_object_path,
        })),
      assignablePeople,
      canUploadEvidence,
    },
  };
}
