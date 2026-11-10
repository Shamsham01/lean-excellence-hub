"use client";

import { useState, type ReactNode } from "react";

import { ExecutionUnitStartForm } from "@/components/organisation/execution-unit-start-form";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

type ExecutionUnitStartDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: ReactNode;
  units: UnitSelectOption[];
  requiresSiteSelection: boolean;
  unitFieldId: string;
  label: string;
  submitLabel: string;
  emptyMessage: string;
  notApplicableMessage?: string;
  lockedLabel?: string;
  formTestId: string;
  unitSelectTestId: string;
  submitTestId: string;
  dialogTitle: string;
  triggerLabel?: string;
  openTestId?: string;
};

export function ExecutionUnitStartDialog({
  dialogTitle,
  triggerLabel,
  openTestId,
  ...formProps
}: ExecutionUnitStartDialogProps) {
  const [open, setOpen] = useState(false);
  const canOpen = formProps.units.length > 0;

  return (
    <>
      <Button
        type="button"
        className="min-h-11"
        disabled={!canOpen}
        data-testid={openTestId ?? `${formProps.submitTestId}-open`}
        onClick={() => setOpen(true)}
      >
        {triggerLabel ?? formProps.submitLabel}
      </Button>
      {!canOpen && formProps.requiresSiteSelection ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="site-context-required"
        >
          {formProps.emptyMessage}
        </p>
      ) : null}
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title={dialogTitle}
        testId={`${formProps.formTestId}-dialog`}
        enableGuard
      >
        <ExecutionUnitStartForm {...formProps} />
      </ResponsiveFormDialog>
    </>
  );
}
