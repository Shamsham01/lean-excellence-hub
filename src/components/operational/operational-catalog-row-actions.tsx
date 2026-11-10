"use client";

import { ExecutionUnitStartDialog } from "@/components/organisation/execution-unit-start-dialog";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

export type OperationalCatalogStartActionConfig = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFieldName: string;
  hiddenFieldValue: string;
  units: UnitSelectOption[];
  requiresSiteSelection: boolean;
  unitFieldId: string;
  dialogTitle: string;
  triggerLabel: string;
  label: string;
  submitLabel: string;
  emptyMessage: string;
  notApplicableMessage?: string;
  lockedLabel?: string;
  formTestId: string;
  unitSelectTestId: string;
  submitTestId: string;
  openTestId: string;
};

export function OperationalCatalogStartAction({
  start,
  unavailableNote,
}: {
  start: OperationalCatalogStartActionConfig | null;
  unavailableNote?: string;
}) {
  if (!start) {
    return (
      <span className="text-xs text-muted-foreground">
        {unavailableNote ?? "—"}
      </span>
    );
  }

  const dialogProps = {
    dialogTitle: start.dialogTitle,
    triggerLabel: start.triggerLabel,
    openTestId: start.openTestId,
    action: start.action,
    hiddenFields: (
      <input
        type="hidden"
        name={start.hiddenFieldName}
        value={start.hiddenFieldValue}
      />
    ),
    units: start.units,
    requiresSiteSelection: start.requiresSiteSelection,
    unitFieldId: start.unitFieldId,
    label: start.label,
    submitLabel: start.submitLabel,
    emptyMessage: start.emptyMessage,
    formTestId: start.formTestId,
    unitSelectTestId: start.unitSelectTestId,
    submitTestId: start.submitTestId,
    ...(start.lockedLabel ? { lockedLabel: start.lockedLabel } : {}),
    ...(start.notApplicableMessage
      ? { notApplicableMessage: start.notApplicableMessage }
      : {}),
  };

  return <ExecutionUnitStartDialog {...dialogProps} />;
}
