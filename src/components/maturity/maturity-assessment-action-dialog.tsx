"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AssessmentActionForm } from "@/components/maturity/assessment-action-form";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

type MaturityAssessmentActionDialogProps = {
  assessmentId: string;
  pillarId: string;
  criterionId: string;
  questions: Array<{ id: string; prompt: string }>;
};

export function MaturityAssessmentActionDialog({
  assessmentId,
  pillarId,
  criterionId,
  questions,
}: MaturityAssessmentActionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        data-testid="create-improvement-action"
        onClick={() => setOpen(true)}
      >
        + Create improvement action
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Create improvement action"
        description="Link an action to this criterion and optional question."
        testId="maturity-assessment-action-dialog"
      >
        <AssessmentActionForm
          layout="dialog"
          assessmentId={assessmentId}
          pillarId={pillarId}
          criterionId={criterionId}
          questions={questions}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </ResponsiveFormDialog>
    </>
  );
}
