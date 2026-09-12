import type { ReactNode } from "react";

import { OrganisationalUnitSelect } from "@/components/organisation/organisational-unit-select";
import { Button } from "@/components/ui/button";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

type ExecutionUnitStartFormProps = {
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
};

export function ExecutionUnitStartForm({
  action,
  hiddenFields,
  units,
  requiresSiteSelection,
  unitFieldId,
  label,
  submitLabel,
  emptyMessage,
  notApplicableMessage,
  lockedLabel = "Audit area",
  formTestId,
  unitSelectTestId,
  submitTestId,
}: ExecutionUnitStartFormProps) {
  const canSubmit = units.length > 0;
  const resolvedEmptyMessage =
    !requiresSiteSelection && notApplicableMessage
      ? notApplicableMessage
      : emptyMessage;

  return (
    <form
      action={action}
      className="flex max-w-full min-w-0 flex-wrap items-end gap-2"
      data-testid={formTestId}
    >
      {hiddenFields}
      {units.length === 1 ? (
        <div
          className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm"
          data-testid={`${unitSelectTestId}-locked`}
        >
          <span>{lockedLabel}</span>
          <p className="border-input min-h-11 rounded-md border bg-surface px-3 py-2 font-medium">
            {units[0]!.name}
          </p>
          <input type="hidden" name="unitId" value={units[0]!.id} />
        </div>
      ) : (
        <OrganisationalUnitSelect
          id={unitFieldId}
          name="unitId"
          label={label}
          options={units}
          required={canSubmit}
          requiresSiteSelection={requiresSiteSelection}
          emptyMessage={resolvedEmptyMessage}
          testId={unitSelectTestId}
          className="min-w-[12rem] flex-1"
        />
      )}
      <Button
        type="submit"
        className="min-h-11 shrink-0"
        disabled={!canSubmit}
        data-testid={submitTestId}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
