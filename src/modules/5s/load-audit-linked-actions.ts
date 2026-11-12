import "server-only";

import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type { ActionDetail } from "@/lib/actions/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type FiveSAuditLinkedActionSummary = {
  id: string;
  questionId: string;
  title: string;
  status: string;
  dueAt: string | null;
  assigneeDisplayName: string | null;
  evidence: EvidenceItem[];
};

export async function loadFiveSAuditLinkedActions(
  auditId: string,
): Promise<FiveSAuditLinkedActionSummary[]> {
  const supabase = await createServerSupabaseClient();

  const { data: contextRows } = await supabase
    .from("five_s_action_context")
    .select("action_id, question_id")
    .eq("audit_id", auditId);

  if (!contextRows?.length) return [];

  const actionIds = [...new Set(contextRows.map((row) => row.action_id))];
  const questionByActionId = new Map(
    contextRows.map((row) => [row.action_id, row.question_id]),
  );

  const details = await Promise.all(
    actionIds.map(async (actionId) => {
      const { data } = await callActionRpc<ActionDetail>(
        supabase,
        "get_action_detail",
        { target_action_id: actionId },
      );
      return { actionId, detail: data };
    }),
  );

  const { data: attachmentRows } = await supabase
    .from("attachments")
    .select("id, filename, mime_type, byte_size, storage_object_path, target_resource_id")
    .in("target_resource_id", actionIds)
    .eq("lifecycle", "active")
    .order("created_at");

  const evidenceByActionId = new Map<string, EvidenceItem[]>();
  for (const row of attachmentRows ?? []) {
    if (row.byte_size == null || !row.target_resource_id) continue;
    const list = evidenceByActionId.get(row.target_resource_id) ?? [];
    list.push({
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      byte_size: row.byte_size,
      storage_object_path: row.storage_object_path,
    });
    evidenceByActionId.set(row.target_resource_id, list);
  }

  return details
    .filter((entry): entry is { actionId: string; detail: ActionDetail } =>
      Boolean(entry.detail),
    )
    .map(({ actionId, detail }) => ({
      id: actionId,
      questionId: questionByActionId.get(actionId) ?? "",
      title: detail.title,
      status: detail.status,
      dueAt: detail.due_at,
      assigneeDisplayName: detail.assignees[0]?.display_name ?? null,
      evidence: evidenceByActionId.get(actionId) ?? [],
    }));
}
