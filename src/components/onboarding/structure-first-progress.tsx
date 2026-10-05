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
  const current = progress.steps.find((step) => step.key === currentStep);
  const currentIndex = progress.steps.findIndex(
    (step) => step.key === currentStep,
  );

  return (
    <nav
      aria-label="Organisation setup progress"
      data-testid="structure-first-progress"
    >
      <p className="mb-3 text-sm text-muted-foreground lg:hidden">
        Step {currentIndex + 1} of {progress.steps.length}
        {current ? (
          <>
            {" "}
            · {current.title} · {structureFirstStatusLabel(current.status)}
            {current.status === "skipped" ? " · discoverable later" : ""}
          </>
        ) : null}
      </p>
      <ol className="flex gap-2 lg:flex-col lg:gap-1">
        {progress.steps.map((step, index) => {
          const isCurrent = step.key === currentStep;
          const complete = step.status === "complete";
          const skipped = step.status === "skipped";
          return (
            <li key={step.key} className="min-w-0 flex-1 lg:flex-none">
              <AppLink
                href={`/onboarding/setup?step=${step.key}`}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${step.title}, ${structureFirstStatusLabel(step.status)}${
                  skipped ? ", discoverable later" : ""
                }`}
                data-testid={`structure-first-progress-${step.key}`}
                data-status={step.status}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-3 rounded-md px-1 py-2 text-sm transition-colors lg:justify-start lg:px-3",
                  isCurrent
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    complete
                      ? "border-success/40 bg-success/15 text-success"
                      : isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-elevated",
                  )}
                  aria-hidden
                >
                  {complete ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="hidden min-w-0 flex-col lg:flex">
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
