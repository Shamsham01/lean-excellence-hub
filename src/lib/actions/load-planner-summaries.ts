import "server-only";

import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type {
  ActionPlannerCardDetails,
  ActionPlannerListItem,
} from "@/lib/actions/planner-types";
import type { ActionDetail } from "@/lib/actions/types";
import { loadDirectoryPeople } from "@/modules/organisation/site-context-server";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
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
  unit_id: string | null;
};

// Batch only the fields consumed by the list. The action RLS policy already
// applies the same visibility predicate as get_action_detail.
export async function loadActionPlannerSummaries(
  rows: RawActionRow[],
): Promise<ActionPlannerListItem[]> {
  if (rows.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const ids = rows.map((row) => row.id);
  const units = [...new Set(rows.map((row) => row.unit_id))];

  const [{ data: ownProfile }, directoryPeople, canReadComments] =
    await Promise.all([
      supabase.rpc("get_own_membership_profile"),
      loadDirectoryPeople(supabase),
      currentMemberHasScopedPermission("comments.read"),
    ]);
  const ownId = (ownProfile as { membership_id?: string } | null)
    ?.membership_id;
  const directoryById = new Map(
    directoryPeople.map((person) => [person.membership_id, person]),
  );

  // PostgREST limits result sizes; chunk IDs and page related rows so comment
  // counts and the first assignee remain correct for large lists.
  const assignees = new Map<string, string>();
  const assignedToMe = new Set<string>();
  const commentCounts = new Map<string, number>();
  const batchSize = 100;
  const pageSize = 500;

  await Promise.all(
    Array.from({ length: Math.ceil(ids.length / batchSize) }, async (_, i) => {
      const batch = ids.slice(i * batchSize, (i + 1) * batchSize);
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("action_assignees")
          .select("action_id, membership_id, assigned_at, id")
          .in("action_id", batch)
          .order("assigned_at")
          .order("id")
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error("Unable to load action assignees.");
        for (const assignment of data ?? []) {
          if (!assignees.has(assignment.action_id)) {
            assignees.set(assignment.action_id, assignment.membership_id);
          }
          if (assignment.membership_id === ownId) {
            assignedToMe.add(assignment.action_id);
          }
        }
        if ((data?.length ?? 0) < pageSize) break;
      }
    }),
  );

  if (canReadComments) {
    await Promise.all(
      Array.from(
        { length: Math.ceil(ids.length / batchSize) },
        async (_, i) => {
          const batch = ids.slice(i * batchSize, (i + 1) * batchSize);
          for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await supabase
              .from("comments")
              .select("id, target_resource_id")
              .in("target_resource_id", batch)
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw new Error("Unable to load action comment counts.");
            for (const comment of data ?? []) {
              commentCounts.set(
                comment.target_resource_id,
                (commentCounts.get(comment.target_resource_id) ?? 0) + 1,
              );
            }
            if ((data?.length ?? 0) < pageSize) break;
          }
        },
      ),
    );
  }

  const missingMemberIds = [...new Set(assignees.values())].filter(
    (id) => !directoryById.has(id),
  );
  const fallbackNames = new Map<string, string | null>();
  await Promise.all(
    Array.from(
      { length: Math.ceil(missingMemberIds.length / batchSize) },
      async (_, i) => {
        const { data } = await supabase
          .from("organisation_memberships")
          .select("id, display_name")
          .in("id", missingMemberIds.slice(i * batchSize, (i + 1) * batchSize));
        for (const member of data ?? []) {
          fallbackNames.set(member.id, member.display_name);
        }
      },
    ),
  );

  // Mirror can_update_action, can_assign_action and can_complete_action.
  // Probe per distinct unit, not per action; the self-scoped completion grant
  // only applies when the current membership is an actual assignee.
  const permissionsByUnit = new Map(
    await Promise.all(
      units.map(async (unitId) => {
        const [update, assign, complete, completeOwn] = await Promise.all([
          currentMemberHasScopedPermission("actions.update", unitId),
          currentMemberHasScopedPermission("actions.assign", unitId),
          currentMemberHasScopedPermission("actions.complete", unitId),
          ownId
            ? currentMemberHasScopedPermission(
                "actions.complete",
                unitId,
                ownId,
              )
            : Promise.resolve(false),
        ]);
        return [unitId, { update, assign, complete, completeOwn }] as const;
      }),
    ),
  );

  return rows.map(({ unit_id, ...row }) => {
    const membershipId = assignees.get(row.id) ?? null;
    const person = membershipId ? directoryById.get(membershipId) : undefined;
    const permissions = permissionsByUnit.get(unit_id)!;
    const canComplete =
      permissions.complete ||
      (permissions.completeOwn && assignedToMe.has(row.id));
    return {
      ...row,
      assignee_membership_id: membershipId,
      assignee_display_name: membershipId
        ? person?.display_name?.trim() ||
          fallbackNames.get(membershipId)?.trim() ||
          "Team member"
        : null,
      assignee_avatar_url: person?.avatar_url ?? null,
      source: null,
      permissions: {
        can_update: permissions.update,
        can_assign: permissions.assign,
        can_complete: canComplete,
        can_start: permissions.update || canComplete,
        can_reopen: permissions.update,
        can_cancel: permissions.update,
      },
      labels: [],
      checklist_done: 0,
      checklist_total: 0,
      comment_count: canReadComments ? (commentCounts.get(row.id) ?? 0) : null,
      card_cover_mime_type: null,
      card_cover_storage_path: null,
    };
  });
}

// Labels and checklist rows have no authenticated SELECT policies. Preserve
// their existing authorised detail RPC, but only when rich cards are requested.
export async function loadActionPlannerCardDetails(
  actionIds: string[],
): Promise<ActionPlannerCardDetails[]> {
  if (actionIds.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  const details = await Promise.all(
    actionIds.map(async (id) => {
      const { data } = await callActionRpc<ActionDetail>(
        supabase,
        "get_action_detail",
        { target_action_id: id },
      );
      return { id, detail: data };
    }),
  );

  const entries = details.filter(
    (entry): entry is { id: string; detail: ActionDetail } =>
      entry.detail != null,
  );

  const fiveSActionIds = entries
    .filter(({ detail }) => detail.source?.resource_type === "five_s_audit")
    .map(({ id }) => id);

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

  return entries.map(({ id, detail }) => {
    const fiveSContext = fiveSContextByActionId.get(id);
    return {
      id,
      source: detail.source,
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
