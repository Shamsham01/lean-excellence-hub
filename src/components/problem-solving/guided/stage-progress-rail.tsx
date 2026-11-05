"use client";

import {
  sortMethodStages,
  type MethodStage,
} from "@/lib/problem-solving/stages";
import { cn } from "@/lib/utils";

type StageProgressRailProps = {
  stages: MethodStage[];
  currentStageId: string | null;
  viewStageId: string | null;
  onViewStage: (stageId: string) => void;
  canMoveStage: boolean;
  onMoveStage?: (stageId: string) => void;
  movingStage?: boolean;
};

export function StageProgressRail({
  stages,
  currentStageId,
  viewStageId,
  onViewStage,
  canMoveStage,
  onMoveStage,
  movingStage,
}: StageProgressRailProps) {
  const sorted = sortMethodStages(stages);
  const activeViewId = viewStageId ?? currentStageId ?? sorted[0]?.id ?? null;
  const currentIndex = sorted.findIndex((stage) => stage.id === currentStageId);

  return (
    <nav
      aria-label="Problem solving stages"
      className="tabs-scroll min-w-0 overflow-x-auto pb-2 lg:overflow-visible"
      data-testid="pps-stage-rail"
    >
      <ol className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-2 lg:gap-2 xl:grid-cols-4 2xl:grid-cols-8">
        {sorted.map((stage, index) => {
          const isViewing = stage.id === activeViewId;
          const isCurrent = stage.id === currentStageId;
          const isPast = currentIndex >= 0 && index < currentIndex;
          const statusLabel = isCurrent
            ? "Current"
            : isPast
              ? "Completed"
              : "Upcoming";

          return (
            <li key={stage.id} className="min-w-[9.5rem] shrink-0 lg:min-w-0">
              <button
                type="button"
                data-testid={`pps-stage-${stage.semantic_stage_key}`}
                disabled={movingStage}
                onClick={() => {
                  onViewStage(stage.id);
                  if (
                    canMoveStage &&
                    onMoveStage &&
                    stage.id !== currentStageId
                  ) {
                    onMoveStage(stage.id);
                  }
                }}
                className={cn(
                  "flex h-full min-h-11 w-full flex-col rounded-lg border px-3 py-2 text-left text-xs transition-colors sm:text-sm",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isViewing
                    ? "border-primary bg-primary/5 text-foreground shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                  movingStage && "opacity-70",
                )}
              >
                <span className="leading-snug font-medium whitespace-normal">
                  {stage.title}
                </span>
                <span className="mt-1 text-[0.65rem] font-medium tracking-wide uppercase sm:text-[0.7rem]">
                  {statusLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
