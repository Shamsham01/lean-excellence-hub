import "server-only";

import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import type { ActionDetail } from "@/lib/actions/types";
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

  return details
    .filter(
      (entry): entry is { row: RawActionRow; detail: ActionDetail } =>
        entry.detail != null,
    )
    .map(({ row, detail }) => ({
      id: row.id,
      action_number: row.action_number,
      title: row.title,
      status: row.status,
      priority: row.priority,
      created_at: row.created_at,
      due_at: row.due_at,
      version: detail.version ?? row.version,
      assignee_display_name: detail.assignees[0]?.display_name ?? null,
      source: detail.source,
      permissions: detail.permissions,
    }));
}
