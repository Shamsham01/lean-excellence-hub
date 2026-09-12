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
  formTestId,
  unitSelectTestId,
  submitTestId,
}: ExecutionUnitStartFormProps) {
  const canSubmit = units.length > 0;

  return (
    <form
      action={action}
      className="flex max-w-full min-w-0 flex-wrap items-end gap-2"
      data-testid={formTestId}
    >
      {hiddenFields}
      <OrganisationalUnitSelect
        id={unitFieldId}
        name="unitId"
        label={label}
        options={units}
        required={canSubmit}
        requiresSiteSelection={requiresSiteSelection}
        emptyMessage={emptyMessage}
        testId={unitSelectTestId}
        className="min-w-[12rem] flex-1"
      />
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
