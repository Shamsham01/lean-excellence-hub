"use client";

import { useState } from "react";

import { StartAssessmentForm } from "@/components/maturity/start-assessment-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type { StartAssessmentDialogProps } from "@/lib/maturity/load-start-assessment-props";

export function StartAssessmentDialog({
  versions,
  people,
  defaultVersionId,
  triggerLabel = "Start assessment",
  triggerTestId = "maturity-start-assessment-dialog-open",
  defaultOpen = false,
  showTrigger = true,
}: StartAssessmentDialogProps & {
  defaultVersionId?: string;
  triggerLabel?: string;
  triggerTestId?: string;
  defaultOpen?: boolean;
  showTrigger?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const disabled = versions.length === 0;

  return (
    <>
      {showTrigger ? (
        <ModuleWriteButton
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          data-testid={triggerTestId}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </ModuleWriteButton>
      ) : null}
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Start assessment"
        description="Choose a Self snapshot or a Formal review with assessor control."
        testId="maturity-start-assessment-dialog"
        contentClassName="sm:max-w-lg"
        enableGuard
      >
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            Publish a maturity framework before starting an assessment.
          </p>
        ) : (
          <StartAssessmentForm
            versions={versions}
            people={people}
            {...(defaultVersionId ? { defaultVersionId } : {})}
            onStarted={() => setOpen(false)}
          />
        )}
      </ResponsiveFormDialog>
    </>
  );
}
