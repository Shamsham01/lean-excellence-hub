"use client";

import { sortMethodStages, type MethodStage } from "@/lib/problem-solving/stages";
import { cn } from "@/lib/utils";

type StageProgressRailProps = {
  stages: MethodStage[];
  currentStageId: string | null;
  viewStageId: string | null;
  onSelectStage: (stageId: string) => void;
  canNavigate: boolean;
};

export function StageProgressRail({
  stages,
  currentStageId,
  viewStageId,
  onSelectStage,
  canNavigate,
}: StageProgressRailProps) {
  const sorted = sortMethodStages(stages);
  const activeViewId = viewStageId ?? currentStageId ?? sorted[0]?.id ?? null;
  const currentIndex = sorted.findIndex((stage) => stage.id === currentStageId);

  return (
    <nav
      aria-label="Problem solving stages"
      className="min-w-0 overflow-x-auto pb-1"
      data-testid="pps-stage-rail"
    >
      <ol className="flex min-w-max gap-1 sm:gap-2">
        {sorted.map((stage, index) => {
          const isViewing = stage.id === activeViewId;
          const isCurrent = stage.id === currentStageId;
          const isPast = currentIndex >= 0 && index < currentIndex;
          return (
            <li key={stage.id}>
              <button
                type="button"
                data-testid={`pps-stage-${stage.semantic_stage_key}`}
                disabled={!canNavigate && !isViewing}
                onClick={() => onSelectStage(stage.id)}
                className={cn(
                  "flex max-w-[11rem] flex-col rounded-lg border px-3 py-2 text-left text-xs transition-colors sm:max-w-none sm:text-sm",
                  isViewing
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                  !canNavigate && !isViewing && "cursor-default opacity-70",
                )}
              >
                <span className="font-medium leading-tight">{stage.title}</span>
                <span className="mt-0.5 text-[0.65rem] uppercase tracking-wide sm:text-[0.7rem]">
                  {isCurrent ? "Current" : isPast ? "Completed" : "Upcoming"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
