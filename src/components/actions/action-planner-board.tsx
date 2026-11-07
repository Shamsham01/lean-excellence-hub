"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  completeAction,
  reopenAction,
  transitionActionStatus,
} from "@/app/(platform)/platform/actions/actions";
import { ActionPlannerCard } from "@/components/actions/action-planner-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import {
  BOARD_STATUS_COLUMNS,
  canTransitionActionWithPermissions,
  actionHasDraggableTransitions,
} from "@/lib/actions/planner-view";
import { actionStatusLabel } from "@/lib/actions/status";
import { cn } from "@/lib/utils";

type ActionPlannerBoardProps = {
  actions: ActionPlannerListItem[];
  onOpen: (actionId: string) => void;
  pendingMove?: boolean;
};

type DragState = {
  actionId: string;
  fromStatus: string;
  version: number;
} | null;

export function ActionPlannerBoard({
  actions,
  onOpen,
  pendingMove = false,
}: ActionPlannerBoardProps) {
  const router = useRouter();
  const [dragging, setDragging] = useState<DragState>(null);
  const [hoverColumn, setHoverColumn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byStatus = useMemo(() => {
    const map = new Map<string, ActionPlannerListItem[]>();
    for (const status of BOARD_STATUS_COLUMNS) {
      map.set(status, []);
    }
    for (const action of actions) {
      const bucket = map.get(action.status) ?? [];
      bucket.push(action);
      map.set(action.status, bucket);
    }
    return map;
  }, [actions]);

  async function handleDrop(targetStatus: string) {
    if (!dragging || busy || pendingMove) return;
    const action = actions.find((row) => row.id === dragging.actionId);
    if (!action) return;

    const allowed = canTransitionActionWithPermissions(
      action.permissions,
      action.status,
      targetStatus,
    );
    if (!allowed) {
      setError("You cannot move this action to that status.");
      setDragging(null);
      setHoverColumn(null);
      return;
    }

    setBusy(true);
    setError(null);

    let result: { error?: string; ok?: true };
    if (targetStatus === "completed") {
      result = await completeAction({
        actionId: action.id,
        expectedVersion: action.version,
      });
    } else if (
      targetStatus === "open" &&
      (action.status === "completed" || action.status === "cancelled")
    ) {
      result = await reopenAction({
        actionId: action.id,
        expectedVersion: action.version,
      });
    } else {
      result = await transitionActionStatus({
        actionId: action.id,
        toStatus: targetStatus,
        expectedVersion: action.version,
      });
    }

    setBusy(false);
    setDragging(null);
    setHoverColumn(null);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (pendingMove) {
    return (
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        data-testid="actions-board-skeleton"
      >
        {BOARD_STATUS_COLUMNS.map((status) => (
          <div
            key={status}
            className="flex min-w-[17rem] flex-1 flex-col gap-2 rounded-lg border border-border bg-surface/60 p-3"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="actions-board">
      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="actions-board-error"
        >
          {error}
        </p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_STATUS_COLUMNS.map((status) => {
          const columnActions = byStatus.get(status) ?? [];
          const droppable =
            dragging != null &&
            (() => {
              const action = actions.find(
                (row) => row.id === dragging.actionId,
              );
              if (!action) return false;
              return canTransitionActionWithPermissions(
                action.permissions,
                action.status,
                status,
              );
            })();

          return (
            <div
              key={status}
              className={cn(
                "flex max-w-[20rem] min-w-[17rem] flex-1 flex-col gap-2 rounded-lg border border-border bg-surface/60 p-3",
                droppable &&
                  hoverColumn === status &&
                  "border-primary/50 bg-primary/5",
              )}
              data-testid={`actions-board-column-${status}`}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                setHoverColumn(status);
              }}
              onDragLeave={() => {
                if (hoverColumn === status) setHoverColumn(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                void handleDrop(status);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {actionStatusLabel(status)}
                </p>
                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {columnActions.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {columnActions.length === 0 ? (
                  <p
                    className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
                    data-testid={`actions-board-empty-${status}`}
                  >
                    No actions
                  </p>
                ) : (
                  columnActions.map((action) => (
                    <ActionPlannerCard
                      key={action.id}
                      action={action}
                      onOpen={onOpen}
                      draggable={actionHasDraggableTransitions(
                        action.permissions,
                        action.status,
                      )}
                      onDragStart={() =>
                        setDragging({
                          actionId: action.id,
                          fromStatus: action.status,
                          version: action.version,
                        })
                      }
                      onDragEnd={() => {
                        setDragging(null);
                        setHoverColumn(null);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
