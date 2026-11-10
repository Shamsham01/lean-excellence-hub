"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const body =
    criterion.guidance ??
    criterion.description ??
    "Review the criterion and capture evidence against each question.";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 gap-2"
          data-testid="assessment-guidance-trigger"
        >
          <Info className="size-4" aria-hidden />
          Guidance
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-w-sm"
        data-testid="assessment-guidance-menu"
      >
        <DropdownMenuLabel>{criterion.name}</DropdownMenuLabel>
        <DropdownMenuItem asChild className="whitespace-normal text-sm">
          <p className="px-2 py-1.5 text-muted-foreground">{body}</p>
        </DropdownMenuItem>
        {levels.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Maturity levels
            </DropdownMenuLabel>
            {levels.map((level) => (
              <DropdownMenuItem
                key={level.level_number}
                asChild
                className="whitespace-normal text-sm"
              >
                <p className="px-2 py-1 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {level.level_number} {level.name}
                  </span>
                  {level.guidance ? ` — ${level.guidance}` : null}
                </p>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
