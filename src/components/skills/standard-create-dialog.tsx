"use client";

import { StandardNameCreateForm } from "@/components/skills/standard-name-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useDialogDefaultOpen } from "@/components/ui/use-dialog-default-open";

export function StandardCreateDialog({
  existingCodes,
  defaultOpen = false,
}: {
  existingCodes: readonly string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useDialogDefaultOpen(defaultOpen);

  return (
    <>
      <ModuleWriteButton
        type="button"
        size="sm"
        className="min-h-11"
        data-testid="skills-standard-new-link"
        onClick={() => setOpen(true)}
      >
        New skills standard
      </ModuleWriteButton>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New skills standard"
        testId="skills-standard-create-dialog"
        enableGuard
      >
        <StandardNameCreateForm
          existingCodes={existingCodes}
          onCreated={() => setOpen(false)}
        />
      </ResponsiveFormDialog>
    </>
  );
}
