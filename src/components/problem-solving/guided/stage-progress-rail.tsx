"use client";

import { Check } from "lucide-react";

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

function StageTimelineNode({
  stage,
  index,
  currentIndex,
  activeViewId,
  isLast,
  movingStage,
  onViewStage,
}: {
  stage: MethodStage;
  index: number;
  currentIndex: number;
  activeViewId: string | null;
  isLast: boolean;
  movingStage?: boolean;
  onViewStage: (stageId: string) => void;
}) {
  const isViewing = stage.id === activeViewId;
  const visual = stageVisualState(index, currentIndex, isViewing);

  return (
    <li className="relative pb-5 pl-1">
      {!isLast ? (
        <span
          className={cn(
            "absolute top-10 left-[19px] w-0.5",
            visual === "complete" ? "bg-success" : "bg-border",
            "h-[calc(100%-12px)]",
          )}
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        data-testid={`pps-stage-${stage.semantic_stage_key}`}
        disabled={movingStage}
        onClick={() => onViewStage(stage.id)}
        className={cn(
          "group flex w-full items-start gap-3 rounded-lg px-2 py-1 text-left text-sm transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          visual === "current" &&
            "bg-primary/10 shadow-[0_0_16px_rgb(70_95_255/0.35)] ring-2 ring-primary/45",
          visual === "upcoming" && "hover:bg-accent/60",
          movingStage && "opacity-70",
        )}
      >
        <span
          className={cn(
            "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
            visual === "complete" &&
              "border-success bg-success text-success-foreground",
            visual === "current" &&
              "border-primary bg-card text-primary shadow-[0_0_12px_rgb(70_95_255/0.45)]",
            visual === "upcoming" &&
              "border-border bg-card text-muted-foreground",
          )}
          aria-hidden
        >
          {visual === "complete" ? (
            <Check className="size-4" strokeWidth={2.5} />
          ) : (
            index + 1
          )}
        </span>
        <span
          className={cn(
            "min-w-0 pt-1 leading-snug font-medium break-words",
            visual === "complete" && "text-foreground",
            visual === "current" && "text-foreground",
            visual === "upcoming" && "text-muted-foreground",
          )}
        >
          {stage.title}
        </span>
      </button>
    </li>
  );
}

function StageButtonMobile({
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

  return (
    <button
      type="button"
      data-testid={`pps-stage-mobile-${stage.semantic_stage_key}`}
      disabled={movingStage}
      onClick={() => onViewStage(stage.id)}
      className={cn(
        "flex min-w-[8.5rem] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150",
        visual === "complete" && "border-success/30 bg-success/10",
        visual === "current" && "border-primary/50 bg-primary/5 shadow-sm",
        visual === "upcoming" && "border-border/50 bg-card",
        movingStage && "opacity-70",
      )}
    >
      {visual === "complete" ? (
        <Check className="size-4 text-success" aria-hidden />
      ) : (
        <span className="font-mono-data text-xs text-muted-foreground">
          {index + 1}
        </span>
      )}
      <span className="truncate font-medium">{stage.title}</span>
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
              <li key={stage.id}>
                <StageButtonMobile
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
          className="hidden min-h-0 w-[290px] shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-card/40 px-5 py-5 lg:flex"
          data-testid="pps-stage-rail"
        >
          <ol className="flex flex-col">
            {sorted.map((stage, index) => (
              <StageTimelineNode
                key={stage.id}
                stage={stage}
                index={index}
                currentIndex={currentIndex}
                activeViewId={activeViewId}
                isLast={index === sorted.length - 1}
                {...(movingStage ? { movingStage } : {})}
                onViewStage={onViewStage}
              />
            ))}
          </ol>
        </nav>
      ) : null}
    </>
  );
}
