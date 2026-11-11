import type { DragEvent } from "react";
import { MessageSquare } from "lucide-react";

import { ActionCardCoverThumb } from "@/components/actions/action-card-cover-thumb";
import { ActionPlannerLabelChips } from "@/components/actions/action-planner-label-chips";
import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
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
  if (action.five_s_lineage?.chip_label) {
    return action.five_s_lineage.chip_label;
  }
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
  const assigneeName = action.assignee_display_name?.trim() ?? "";
  const isUnassigned = !assigneeName;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(action.id)}
      className={cn(
        "group w-full min-w-0 rounded-xl border border-border/60 bg-card text-left shadow-[var(--shadow-theme-xs)] transition-all hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        layout === "row" ? "px-4 py-3" : "flex h-full flex-col gap-3 p-4",
        draggable && "cursor-grab active:cursor-grabbing",
        draggable && "task-dragging:opacity-80",
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
          <p className="truncate text-sm font-medium text-foreground">
            {action.title}
          </p>
          <p className="typography-metadata mt-0.5">
            {formatActionReference(action.action_number, action.title)}
          </p>
          <ActionPlannerLabelChips labels={action.labels} className="mt-2" />
          {layout === "tile" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {due ? (
                <span className="font-mono-data text-xs text-muted-foreground">
                  {due}
                </span>
              ) : null}
              {action.checklist_total > 0 ? (
                <span
                  className="font-mono-data text-xs text-muted-foreground"
                  data-testid="action-card-checklist-count"
                >
                  {action.checklist_done}/{action.checklist_total}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden />
                <span className="font-mono-data">{action.comment_count}</span>
              </span>
            </div>
          ) : null}
          {hint && layout === "row" ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex shrink-0 gap-1.5",
            layout === "tile"
              ? "flex-wrap items-center justify-between"
              : "items-center",
          )}
        >
          {layout === "row" ? (
            <>
              {action.checklist_total > 0 ? (
                <span
                  className="font-mono-data text-xs text-muted-foreground"
                  data-testid="action-card-checklist-count"
                >
                  {action.checklist_done}/{action.checklist_total}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden />
                <span className="font-mono-data">{action.comment_count}</span>
              </span>
            </>
          ) : null}
          <ActionCardCoverThumb
            mimeType={action.card_cover_mime_type}
            storagePath={action.card_cover_storage_path}
            alt={`${action.title} cover`}
          />
          <div className="flex flex-wrap gap-1">
            <Badge variant={actionStatusBadgeVariant(action.status)}>
              {actionStatusLabel(action.status)}
            </Badge>
            <Badge variant="secondary">
              {actionPriorityLabel(action.priority)}
            </Badge>
          </div>
          <PlatformMemberAvatar
            displayName={assigneeName || "Unassigned"}
            avatarUrl={action.assignee_avatar_url}
            unassigned={isUnassigned}
            showHoverTitle={!isUnassigned}
            size="sm"
          />
        </div>
      </div>
    </button>
  );
}
