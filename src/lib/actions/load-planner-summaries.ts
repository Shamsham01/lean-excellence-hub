import "server-only";

import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import { loadFiveSActionLineage } from "@/app/(platform)/platform/actions/actions";
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

  const lineageByActionId = new Map(
    (
      await Promise.all(
        entries
          .filter(
            ({ detail }) => detail.source?.resource_type === "five_s_audit",
          )
          .map(async ({ row }) => {
            const lineage = await loadFiveSActionLineage(row.id);
            return [row.id, lineage] as const;
          }),
      )
    ).filter(([, lineage]) => lineage != null),
  );

  return entries.map(({ row, detail }) => {
    const assignee = detail.assignees[0];
    const membershipId = assignee?.membership_id ?? null;
    const fiveSLineage = lineageByActionId.get(row.id) as
      ActionDetail["five_s_lineage"] | undefined;
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
      five_s_lineage: fiveSLineage ?? null,
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
    };
  });
}
