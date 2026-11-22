"use client";

import type { DragEvent } from "react";
import { GripVertical, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  completeAction,
  reopenAction,
} from "@/app/(platform)/platform/actions/actions";
import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import {
  actionPriorityLabel,
  formatActionReference,
  formatDueDate,
} from "@/lib/actions/status";
import { cn } from "@/lib/utils";

export function ActionTaskListRow({
  action,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  className,
}: {
  action: ActionPlannerListItem;
  onOpen: (actionId: string) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const due = formatDueDate(action.due_at);
  const isDone = action.status === "completed" || action.status === "verified";
  const assigneeName = action.assignee_display_name?.trim() ?? "";
  const isUnassigned = !assigneeName;

  async function handleToggleComplete(nextChecked: boolean) {
    if (nextChecked) {
      if (!action.permissions.can_complete) return;
      const result = await completeAction({
        actionId: action.id,
        expectedVersion: action.version,
      });
      if (!result.error) router.refresh();
      return;
    }
    if (!action.permissions.can_reopen) return;
    const result = await reopenAction({
      actionId: action.id,
      expectedVersion: action.version,
    });
    if (!result.error) router.refresh();
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex w-full min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-card px-2 py-2.5 shadow-[var(--shadow-theme-xs)] transition-colors hover:bg-muted/20 sm:gap-3 sm:px-3",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
      data-testid={`action-planner-card-${action.id}`}
    >
      <span
        className={cn(
          "hidden shrink-0 text-muted-foreground sm:inline",
          !draggable && "opacity-30",
        )}
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>
      <Checkbox
        checked={isDone}
        disabled={
          isDone
            ? !action.permissions.can_reopen
            : !action.permissions.can_complete
        }
        aria-label={
          isDone ? `Mark ${action.title} as open` : `Complete ${action.title}`
        }
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) => {
          void handleToggleComplete(Boolean(checked));
        }}
      />
      <button
        type="button"
        onClick={() => onOpen(action.id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p
            className={cn(
              "truncate text-sm font-medium text-foreground",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {action.title}
          </p>
          <p className="typography-metadata truncate">
            {formatActionReference(action.action_number, action.title)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <Badge variant="secondary" className="max-w-24 truncate font-normal">
            {actionPriorityLabel(action.priority)}
          </Badge>
          {due ? (
            <span className="font-mono-data text-xs text-muted-foreground">
              {due}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3.5" aria-hidden />
            <span className="font-mono-data">{action.comment_count}</span>
          </span>
          <PlatformMemberAvatar
            displayName={assigneeName || "Unassigned"}
            avatarUrl={action.assignee_avatar_url}
            unassigned={isUnassigned}
            showHoverTitle={!isUnassigned}
            size="sm"
            className="size-8"
          />
        </div>
      </button>
    </div>
  );
}
