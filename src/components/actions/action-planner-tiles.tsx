"use client";

import { ActionPlannerCard } from "@/components/actions/action-planner-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";

type ActionPlannerTilesProps = {
  actions: ActionPlannerListItem[];
  onOpen: (actionId: string) => void;
  pending?: boolean;
};

export function ActionPlannerTiles({
  actions,
  onOpen,
  pending = false,
}: ActionPlannerTilesProps) {
  if (pending) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        data-testid="actions-tiles-skeleton"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      data-testid="actions-tiles"
    >
      {actions.map((action) => (
        <ActionPlannerCard
          key={action.id}
          action={action}
          layout="tile"
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
