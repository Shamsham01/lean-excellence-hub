import type { ActionPlannerListItem } from "@/lib/actions/planner-types";

export type ActionListTab = "all" | "todo" | "in_progress" | "completed";

export function filterActionsByListTab(
  actions: ActionPlannerListItem[],
  tab: ActionListTab,
): ActionPlannerListItem[] {
  switch (tab) {
    case "todo":
      return actions.filter((a) => a.status === "open");
    case "in_progress":
      return actions.filter((a) => a.status === "in_progress");
    case "completed":
      return actions.filter((a) =>
        ["completed", "verified"].includes(a.status),
      );
    default:
      return actions;
  }
}

export function countActionsForListTab(
  actions: ActionPlannerListItem[],
  tab: ActionListTab,
): number {
  return filterActionsByListTab(actions, tab).length;
}

export type ActionListGroup = {
  id: string;
  label: string;
  actions: ActionPlannerListItem[];
};

export function groupActionsForList(
  actions: ActionPlannerListItem[],
): ActionListGroup[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const buckets = {
    overdue: [] as ActionPlannerListItem[],
    today: [] as ActionPlannerListItem[],
    upcoming: [] as ActionPlannerListItem[],
    noDue: [] as ActionPlannerListItem[],
  };

  for (const action of actions) {
    if (!action.due_at) {
      buckets.noDue.push(action);
      continue;
    }
    const due = new Date(action.due_at);
    if (due < startOfToday) {
      buckets.overdue.push(action);
    } else if (due < endOfToday) {
      buckets.today.push(action);
    } else {
      buckets.upcoming.push(action);
    }
  }

  const sortByDue = (list: ActionPlannerListItem[]) =>
    list.sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    });

  return [
    { id: "overdue", label: "Overdue", actions: sortByDue(buckets.overdue) },
    { id: "today", label: "Due today", actions: sortByDue(buckets.today) },
    { id: "upcoming", label: "Upcoming", actions: sortByDue(buckets.upcoming) },
    { id: "no-due", label: "No due date", actions: sortByDue(buckets.noDue) },
  ].filter((group) => group.actions.length > 0);
}

export const KANBAN_STATUS_COLUMNS = [
  "open",
  "in_progress",
  "completed",
] as const;
