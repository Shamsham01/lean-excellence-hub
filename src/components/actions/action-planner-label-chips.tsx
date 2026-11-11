import type { ActionLabel } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

export function ActionPlannerLabelChips({
  labels,
  className,
  max = 3,
}: {
  labels: ActionLabel[];
  className?: string;
  max?: number;
}) {
  if (labels.length === 0) return null;

  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;

  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      data-testid="action-planner-label-chips"
    >
      {visible.map((label) => (
        <span
          key={label.id}
          className="inline-flex max-w-[7rem] truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: label.color }}
          title={label.name}
        >
          {label.name}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-[10px] font-medium text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
