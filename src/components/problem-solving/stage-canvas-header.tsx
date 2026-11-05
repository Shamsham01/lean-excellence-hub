"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GuidedStageConfig } from "@/lib/problem-solving/guided-flow";

type StageCanvasHeaderProps = {
  config: GuidedStageConfig;
  isViewingCurrentStage: boolean;
  canMoveStage: boolean;
  onAdvanceToViewedStage?: () => void;
  advancing?: boolean;
};

export function StageCanvasHeader({
  config,
  isViewingCurrentStage,
  canMoveStage,
  onAdvanceToViewedStage,
  advancing,
}: StageCanvasHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3"
      data-testid="pps-stage-canvas-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {config.title}
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={`About ${config.title}`}
              data-testid="pps-stage-info"
            >
              <CircleHelp className="size-4" aria-hidden />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{config.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{config.purpose}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {config.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="mt-4">
                Close
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
      {!isViewingCurrentStage && canMoveStage && onAdvanceToViewedStage ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={advancing}
          data-testid="pps-advance-to-viewed-stage"
          onClick={onAdvanceToViewedStage}
        >
          {advancing ? "Updating…" : "Set as current stage"}
        </Button>
      ) : null}
    </div>
  );
}
