import { Check } from "lucide-react";

import { AppLink } from "@/components/ui/app-link";
import { cn } from "@/lib/utils";
import {
  structureFirstStatusLabel,
  type StructureFirstProgress,
  type StructureFirstStepKey,
} from "@/modules/organisation-onboarding";

export function StructureFirstProgressNav({
  progress,
  currentStep,
}: {
  progress: StructureFirstProgress;
  currentStep: StructureFirstStepKey;
}) {
  return (
    <nav
      aria-label="Organisation setup progress"
      data-testid="structure-first-progress"
    >
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {progress.steps.map((step, index) => {
          const current = step.key === currentStep;
          const complete = step.status === "complete";
          const skipped = step.status === "skipped";
          return (
            <li key={step.key} className="min-w-fit shrink-0 lg:min-w-0">
              <AppLink
                href={`/onboarding/setup?step=${step.key}`}
                aria-current={current ? "step" : undefined}
                data-testid={`structure-first-progress-${step.key}`}
                data-status={step.status}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  current
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    complete
                      ? "border-success/40 bg-success/15 text-success"
                      : current
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-elevated",
                  )}
                  aria-hidden
                >
                  {complete ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {structureFirstStatusLabel(step.status)}
                    {skipped ? " · discoverable later" : ""}
                  </span>
                </span>
              </AppLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
