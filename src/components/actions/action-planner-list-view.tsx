"use client";

import { ActionPlannerCard } from "@/components/actions/action-planner-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";

type ActionPlannerListViewProps = {
  actions: ActionPlannerListItem[];
  onOpen: (actionId: string) => void;
  pending?: boolean;
};

export function ActionPlannerListView({
  actions,
  onOpen,
  pending = false,
}: ActionPlannerListViewProps) {
  if (pending) {
    return (
      <div className="flex flex-col gap-2" data-testid="actions-list-skeleton">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="actions-planner-list">
      {actions.map((action) => (
        <ActionPlannerCard
          key={action.id}
          action={action}
          onOpen={onOpen}
          layout="row"
        />
      ))}
    </div>
  );
}
