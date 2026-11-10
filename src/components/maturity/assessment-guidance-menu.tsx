"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AssessmentLevel } from "@/modules/maturity/assessment-workspace-types";

type CriterionGuidance = {
  name: string;
  description?: string | null;
  guidance?: string | null;
};

export function AssessmentGuidanceMenu({
  criterion,
  levels,
}: {
  criterion: CriterionGuidance;
  levels: AssessmentLevel[];
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const body =
    criterion.guidance ??
    criterion.description ??
    "Review the criterion and capture evidence against each question.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 gap-2"
          data-testid="assessment-guidance-trigger"
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={`Guidance for ${criterion.name}`}
        >
          <Info className="size-4" aria-hidden />
          Guidance
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={contentId}
        align="start"
        className="max-w-sm space-y-3 text-sm"
        data-testid="assessment-guidance-menu"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="font-semibold text-foreground">{criterion.name}</p>
        <p className="text-muted-foreground">{body}</p>
        {levels.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Maturity levels
            </p>
            <ul className="space-y-2">
              {levels.map((level) => (
                <li key={level.level_number} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {level.level_number} {level.name}
                  </span>
                  {level.guidance ? ` — ${level.guidance}` : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
