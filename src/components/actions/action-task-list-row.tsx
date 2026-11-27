"use client";

import type { DragEvent } from "react";
import { GripVertical, MessageSquare } from "lucide-react";
import type { PlannerTransition } from "@/lib/actions/use-planner-transitions";
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
  onTransition,
  pending = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  className,
}: {
  action: ActionPlannerListItem;
  onOpen: (actionId: string) => void;
  onTransition: PlannerTransition;
  pending?: boolean;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  className?: string;
}) {
  const due = formatDueDate(action.due_at);
  const isDone = action.status === "completed" || action.status === "verified";
  const assigneeName = action.assignee_display_name?.trim() ?? "";
  const isUnassigned = !assigneeName;

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
          pending ||
          (isDone
            ? action.status === "verified" || !action.permissions.can_reopen
            : action.status === "cancelled" || !action.permissions.can_complete)
        }
        aria-label={
          isDone ? `Mark ${action.title} as open` : `Complete ${action.title}`
        }
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) => {
          void onTransition(action, checked ? "completed" : "open");
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
          {action.comment_count !== null ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="font-mono-data">{action.comment_count}</span>
            </span>
          ) : null}
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
