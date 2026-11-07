import type { DragEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import {
  actionPriorityLabel,
  actionStatusBadgeVariant,
  actionStatusLabel,
  formatActionReference,
  formatDueDate,
} from "@/lib/actions/status";

type ActionPlannerCardProps = {
  action: ActionPlannerListItem;
  onOpen: (actionId: string) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  layout?: "row" | "tile";
  className?: string;
};

function sourceHint(action: ActionPlannerListItem): string | null {
  const source = action.source;
  if (!source) return null;
  const reference = source.reference?.trim();
  const title = source.title?.trim();
  if (reference && title) return `${reference} · ${title}`;
  return reference || title || source.resource_type.replaceAll("_", " ");
}

export function ActionPlannerCard({
  action,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  layout = "row",
  className,
}: ActionPlannerCardProps) {
  const hint = sourceHint(action);
  const due = formatDueDate(action.due_at);

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(action.id)}
      className={cn(
        "group w-full rounded-lg border border-border bg-card text-left shadow-[var(--shadow-theme-xs)] transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        layout === "row" ? "px-4 py-3" : "flex h-full flex-col gap-3 p-4",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
      data-testid={`action-planner-card-${action.id}`}
    >
      <div
        className={cn(
          "flex gap-3",
          layout === "row" ? "items-center justify-between" : "flex-col",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{action.title}</p>
          <p className="typography-metadata mt-0.5">
            {formatActionReference(action.action_number, action.title)}
            {due
              ? ` · Due ${due}`
              : ` · ${new Date(action.created_at).toLocaleDateString("en-GB")}`}
          </p>
          {action.assignee_display_name ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Owner {action.assignee_display_name}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Unassigned</p>
          )}
          {hint ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex shrink-0 gap-1.5",
            layout === "tile" ? "flex-wrap" : "items-center",
          )}
        >
          <Badge variant={actionStatusBadgeVariant(action.status)}>
            {actionStatusLabel(action.status)}
          </Badge>
          <Badge variant="secondary">
            {actionPriorityLabel(action.priority)}
          </Badge>
        </div>
      </div>
    </button>
  );
}
