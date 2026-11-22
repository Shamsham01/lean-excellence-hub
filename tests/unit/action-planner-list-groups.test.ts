import { describe, expect, it } from "vitest";

import {
  countActionsForListTab,
  filterActionsByListTab,
  groupActionsForList,
} from "@/lib/actions/planner-list-groups";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";

function row(
  partial: Partial<ActionPlannerListItem> & Pick<ActionPlannerListItem, "id">,
): ActionPlannerListItem {
  return {
    action_number: null,
    title: "Action",
    status: "open",
    priority: "medium",
    created_at: "2026-01-01T00:00:00.000Z",
    due_at: null,
    version: 1,
    assignee_display_name: null,
    assignee_membership_id: null,
    assignee_avatar_url: null,
    source: null,
    permissions: {
      can_update: true,
      can_assign: true,
      can_complete: true,
      can_start: true,
      can_reopen: true,
      can_cancel: true,
    },
    labels: [],
    checklist_done: 0,
    checklist_total: 0,
    comment_count: 0,
    card_cover_mime_type: null,
    card_cover_storage_path: null,
    ...partial,
  };
}

describe("action planner list groups", () => {
  it("filters tabs", () => {
    const actions = [
      row({ id: "a", status: "open" }),
      row({ id: "b", status: "in_progress" }),
      row({ id: "c", status: "completed" }),
      row({ id: "d", status: "verified" }),
    ];
    expect(filterActionsByListTab(actions, "todo")).toHaveLength(1);
    expect(filterActionsByListTab(actions, "completed")).toHaveLength(2);
    expect(countActionsForListTab(actions, "all")).toBe(4);
  });

  it("groups by due buckets", () => {
    const actions = [
      row({ id: "a", due_at: "1999-01-01T00:00:00.000Z" }),
      row({ id: "b", due_at: null }),
    ];
    const groups = groupActionsForList(actions);
    expect(groups.map((g) => g.id)).toEqual(["overdue", "no-due"]);
  });
});
