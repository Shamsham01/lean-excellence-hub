"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionCreateDialog } from "@/components/actions/action-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";

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
  const [createdActionId, setCreatedActionId] = useState<string | null>(null);

  return (
    <>
      <ModuleWriteButton
        type="button"
        variant="outline"
        className="min-h-11"
        data-testid="create-improvement-action"
        onClick={() => {
          setCreatedActionId(null);
          setOpen(true);
        }}
      >
        + Create improvement action
      </ModuleWriteButton>
      {createdActionId ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="action-created"
        >
          Action created.
        </p>
      ) : null}
      <ActionCreateDialog
        open={open}
        onOpenChange={setOpen}
        maturityContext={{
          assessmentId,
          pillarId,
          criterionId,
          questions,
        }}
        onCreated={(actionId) => {
          setCreatedActionId(actionId);
          router.refresh();
        }}
      />
    </>
  );
}
