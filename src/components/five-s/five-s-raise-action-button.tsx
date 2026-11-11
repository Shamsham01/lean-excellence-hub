"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionCreateDialog } from "@/components/actions/action-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import type { FiveSAuditAnswerSnapshot } from "@/modules/5s/build-action-prefill";

export type FiveSRaiseActionContext = {
  auditId: string;
  sectionId: string;
  questionId: string;
  questionPrompt: string;
  questionType: string;
  answer?: FiveSAuditAnswerSnapshot;
  standardName: string;
  unitName: string;
};

export function FiveSRaiseActionButton({
  context,
  className,
  testId = "five-s-raise-action",
}: {
  context: FiveSRaiseActionContext;
  className?: string;
  testId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ModuleWriteButton
        type="button"
        variant="outline"
        className={className ?? "min-h-11"}
        data-testid={testId}
        onClick={() => setOpen(true)}
      >
        Raise action
      </ModuleWriteButton>
      <ActionCreateDialog
        open={open}
        onOpenChange={setOpen}
        fiveSContext={context}
        onCreated={() => {
          router.refresh();
        }}
      />
    </>
  );
}
