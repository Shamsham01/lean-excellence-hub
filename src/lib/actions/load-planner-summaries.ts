import "server-only";

import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import type { ActionDetail } from "@/lib/actions/types";
import { loadMembershipAvatarUrls } from "@/lib/people/membership-avatar-urls";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type RawActionRow = {
  id: string;
  action_number: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  due_at: string | null;
  version: number;
};

export async function loadActionPlannerSummaries(
  rows: RawActionRow[],
): Promise<ActionPlannerListItem[]> {
  if (rows.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  const details = await Promise.all(
    rows.map(async (row) => {
      const { data } = await callActionRpc<ActionDetail>(
        supabase,
        "get_action_detail",
        { target_action_id: row.id },
      );
      return { row, detail: data };
    }),
  );

  const entries = details.filter(
    (entry): entry is { row: RawActionRow; detail: ActionDetail } =>
      entry.detail != null,
  );

  const assigneeIds = entries
    .map(({ detail }) => detail.assignees[0]?.membership_id)
    .filter((id): id is string => Boolean(id));

  const avatarUrls = await loadMembershipAvatarUrls(assigneeIds);

  const fiveSActionIds = entries
    .filter(
      ({ detail }) => detail.source?.resource_type === "five_s_audit",
    )
    .map(({ row }) => row.id);

  const fiveSContextByActionId = new Map<
    string,
    { question_prompt: string; audit_href: string }
  >();

  if (fiveSActionIds.length > 0) {
    const { data: contextRows } = await supabase
      .from("five_s_action_context")
      .select("action_id, audit_id, question_id")
      .in("action_id", fiveSActionIds);

    const questionIds = [
      ...new Set(
        (contextRows ?? [])
          .map((row) => row.question_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const promptByQuestionId = new Map<string, string>();
    if (questionIds.length > 0) {
      const { data: questions } = await supabase
        .from("template_questions")
        .select("id, prompt")
        .in("id", questionIds);
      for (const question of questions ?? []) {
        promptByQuestionId.set(question.id, question.prompt);
      }
    }

    for (const row of contextRows ?? []) {
      if (!row.audit_id) continue;
      const prompt =
        row.question_id != null
          ? (promptByQuestionId.get(row.question_id) ?? null)
          : null;
      if (!prompt) continue;
      fiveSContextByActionId.set(row.action_id, {
        question_prompt: prompt,
        audit_href: `/platform/5s/audits/${row.audit_id}`,
      });
    }
  }

  return entries.map(({ row, detail }) => {
    const assignee = detail.assignees[0];
    const membershipId = assignee?.membership_id ?? null;
    const fiveSContext = fiveSContextByActionId.get(row.id);
    return {
      id: row.id,
      action_number: row.action_number,
      title: row.title,
      status: row.status,
      priority: row.priority,
      created_at: row.created_at,
      due_at: row.due_at,
      version: detail.version ?? row.version,
      assignee_display_name: assignee?.display_name ?? null,
      assignee_membership_id: membershipId,
      assignee_avatar_url: membershipId
        ? (avatarUrls.get(membershipId) ?? null)
        : null,
      source: detail.source,
      permissions: detail.permissions,
      labels: detail.labels ?? [],
      checklist_done: (detail.checklist_items ?? []).filter(
        (item) => item.is_done,
      ).length,
      checklist_total: detail.checklist_items?.length ?? 0,
      comment_count: detail.comment_count ?? 0,
      card_cover_mime_type: detail.card_cover_attachment?.mime_type ?? null,
      card_cover_storage_path:
        detail.card_cover_attachment?.storage_object_path ?? null,
      five_s_question_prompt: fiveSContext?.question_prompt ?? null,
      five_s_audit_href: fiveSContext?.audit_href ?? null,
    };
  });
}
