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
  /** When set, only render the matching rail (default: both). */
  variant?: "both" | "mobile" | "desktop";
};

function stageVisualState(
  index: number,
  currentIndex: number,
  isViewing: boolean,
): "complete" | "current" | "upcoming" {
  if (currentIndex >= 0 && index < currentIndex) return "complete";
  if (isViewing || (currentIndex >= 0 && index === currentIndex)) {
    return "current";
  }
  return "upcoming";
}

const stateStyles = {
  complete: {
    row: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  current: {
    row: "border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-50",
    dot: "bg-amber-500",
  },
  upcoming: {
    row: "text-muted-foreground hover:bg-muted/50",
    dot: "bg-muted-foreground/35",
  },
} as const;

function StageButton({
  stage,
  index,
  currentIndex,
  activeViewId,
  movingStage,
  onViewStage,
}: {
  stage: MethodStage;
  index: number;
  currentIndex: number;
  activeViewId: string | null;
  movingStage?: boolean;
  onViewStage: (stageId: string) => void;
}) {
  const isViewing = stage.id === activeViewId;
  const visual = stageVisualState(index, currentIndex, isViewing);
  const styles = stateStyles[visual];

  return (
    <button
      type="button"
      data-testid={`pps-stage-${stage.semantic_stage_key}`}
      disabled={movingStage}
      onClick={() => onViewStage(stage.id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        styles.row,
        isViewing && visual !== "current" && "ring-1 ring-ring/40",
        movingStage && "opacity-70",
      )}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", styles.dot)}
        aria-hidden
      />
      <span className="min-w-0 leading-snug font-medium">{stage.title}</span>
    </button>
  );
}

export function StageProgressRail({
  stages,
  currentStageId,
  viewStageId,
  onViewStage,
  movingStage,
  variant = "both",
}: StageProgressRailProps) {
  const sorted = sortMethodStages(stages);
  const activeViewId = viewStageId ?? currentStageId ?? sorted[0]?.id ?? null;
  const currentIndex = sorted.findIndex((stage) => stage.id === currentStageId);

  const showMobile = variant === "both" || variant === "mobile";
  const showDesktop = variant === "both" || variant === "desktop";

  return (
    <>
      {showMobile ? (
        <nav
          aria-label="Problem solving stages"
          className="tabs-scroll min-w-0 overflow-x-auto pb-2 lg:hidden"
          data-testid="pps-stage-rail-mobile"
        >
          <ol className="flex min-w-max gap-2">
            {sorted.map((stage, index) => (
              <li key={stage.id} className="min-w-[8.5rem] shrink-0">
                <StageButton
                  stage={stage}
                  index={index}
                  currentIndex={currentIndex}
                  activeViewId={activeViewId}
                  {...(movingStage ? { movingStage } : {})}
                  onViewStage={onViewStage}
                />
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {showDesktop ? (
        <nav
          aria-label="Problem solving stages"
          className="hidden min-h-0 w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/20 px-2 py-3 lg:flex"
          data-testid="pps-stage-rail"
        >
          <ol className="flex flex-col gap-1">
            {sorted.map((stage, index) => (
              <li key={stage.id}>
                <StageButton
                  stage={stage}
                  index={index}
                  currentIndex={currentIndex}
                  activeViewId={activeViewId}
                  {...(movingStage ? { movingStage } : {})}
                  onViewStage={onViewStage}
                />
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </>
  );
}
