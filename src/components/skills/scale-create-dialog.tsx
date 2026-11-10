"use client";

import { useState } from "react";

import { ScaleNameCreateForm } from "@/components/skills/scale-name-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

export function ScaleCreateDialog({
  triggerLabel = "New proficiency scale",
  defaultOpen = false,
}: {
  triggerLabel?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <ModuleWriteButton
        type="button"
        size="sm"
        className="min-h-11"
        data-testid="skills-scale-new-link"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </ModuleWriteButton>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New proficiency scale"
        description="Name the scale, then edit levels on the detail page."
        testId="skills-scale-create-dialog"
        enableGuard
      >
        <ScaleNameCreateForm onCreated={() => setOpen(false)} />
      </ResponsiveFormDialog>
    </>
  );
}
