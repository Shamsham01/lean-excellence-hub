"use client";

import { useMemo, useState } from "react";

import { ActionTaskListRow } from "@/components/actions/action-task-list-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import {
  type ActionListTab,
  countActionsForListTab,
  filterActionsByListTab,
  groupActionsForList,
} from "@/lib/actions/planner-list-groups";

type ActionPlannerListViewProps = {
  actions: ActionPlannerListItem[];
  onOpen: (actionId: string) => void;
  pending?: boolean;
  sortBy: "due" | "created" | "title";
};

export function ActionPlannerListView({
  actions,
  onOpen,
  pending = false,
  sortBy,
}: ActionPlannerListViewProps) {
  const [tab, setTab] = useState<ActionListTab>("all");

  const tabbed = useMemo(
    () => filterActionsByListTab(actions, tab),
    [actions, tab],
  );

  const sorted = useMemo(() => {
    const copy = [...tabbed];
    copy.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "created") {
        return b.created_at.localeCompare(a.created_at);
      }
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    });
    return copy;
  }, [sortBy, tabbed]);

  const groups = useMemo(() => groupActionsForList(sorted), [sorted]);

  if (pending) {
    return (
      <div className="flex flex-col gap-2" data-testid="actions-list-skeleton">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const tabs: Array<{ id: ActionListTab; label: string }> = [
    { id: "all", label: "All" },
    { id: "todo", label: "To do" },
    { id: "in_progress", label: "In progress" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div
      className="flex min-w-0 flex-col gap-4"
      data-testid="actions-planner-list"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ActionListTab)}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          {tabs.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="gap-1.5 data-[state=active]:bg-card"
              data-testid={`actions-list-tab-${item.id}`}
            >
              {item.label}
              <span className="font-mono-data rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {countActionsForListTab(actions, item.id)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No actions in this tab.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h3>
              <p className="sr-only">
                {group.actions.length} action
                {group.actions.length === 1 ? "" : "s"}
              </p>
              {group.actions.map((action) => (
                <ActionTaskListRow
                  key={action.id}
                  action={action}
                  onOpen={onOpen}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
