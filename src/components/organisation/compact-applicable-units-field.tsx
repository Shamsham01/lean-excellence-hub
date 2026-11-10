"use client";

import { useState } from "react";

import { ApplicableUnitsPickerDialog } from "@/components/organisation/applicable-units-picker-dialog";
import { Button } from "@/components/ui/button";
import { formatApplicableUnitsCompactSummary } from "@/modules/organisation/applicability-summary";
import type { UnitSelectOption } from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

type CompactApplicableUnitsFieldProps = {
  hierarchyUnits: FlatOrganisationUnit[];
  options: UnitSelectOption[];
  preservedIds?: readonly string[];
  staleWarning?: string | null;
  staleWarningTestId?: string;
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
  description?: string;
  selectedIds?: ReadonlySet<string>;
  defaultSelectedIds?: ReadonlySet<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  inputName?: string;
};

export function CompactApplicableUnitsField({
  hierarchyUnits,
  options,
  preservedIds = [],
  staleWarning = null,
  staleWarningTestId = "five-s-stale-applicability-warning",
  requiresSiteSelection = false,
  emptyMessage = "Select an active site in the sidebar before choosing applicable areas.",
  description,
  selectedIds: controlledSelectedIds,
  defaultSelectedIds,
  onSelectedIdsChange,
  inputName = "applicableUnitIds",
}: CompactApplicableUnitsFieldProps) {
  const selectableIds = new Set(options.map((option) => option.id));
  const [uncontrolled, setUncontrolled] = useState<Set<string>>(
    () => new Set(defaultSelectedIds ?? []),
  );
  const selectedIds = controlledSelectedIds ?? uncontrolled;
  const [pickerOpen, setPickerOpen] = useState(false);

  const setSelectedIds = (next: Set<string>) => {
    if (controlledSelectedIds === undefined) {
      setUncontrolled(next);
    }
    onSelectedIdsChange?.(next);
  };

  if (requiresSiteSelection || options.length === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="applicable-units-field">
        {preservedIds.map((id) => (
          <input key={id} type="hidden" name={inputName} value={id} />
        ))}
        {[...selectedIds].map((id) => (
          <input key={id} type="hidden" name={inputName} value={id} />
        ))}
        <p className="text-sm font-medium">Applicable areas</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {staleWarning ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid={staleWarningTestId}
          >
            {staleWarning}
          </p>
        ) : null}
        <p
          className="text-sm text-muted-foreground"
          data-testid="applicable-units-empty"
        >
          {requiresSiteSelection
            ? emptyMessage
            : "No organisational units are available."}
        </p>
      </div>
    );
  }

  const summary = formatApplicableUnitsCompactSummary(selectedIds, hierarchyUnits, {
    emptyLabel: "No locations selected",
  });

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2"
      data-testid="applicable-units-field"
    >
      <legend className="text-sm font-medium">Applicable areas</legend>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {preservedIds.map((id) => (
        <input key={id} type="hidden" name={inputName} value={id} />
      ))}
      {[...selectedIds].map((id) => (
        <input key={id} type="hidden" name={inputName} value={id} />
      ))}
      {staleWarning ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid={staleWarningTestId}
        >
          {staleWarning}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" data-testid="applicable-units-compact-summary">
          <span className="text-muted-foreground">Applies to: </span>
          {summary}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full shrink-0 sm:w-fit"
          data-testid="applicable-units-edit-locations"
          onClick={() => setPickerOpen(true)}
        >
          Edit locations
        </Button>
      </div>
      <ApplicableUnitsPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        hierarchyUnits={hierarchyUnits}
        selectableUnitIds={selectableIds}
        selectedIds={selectedIds}
        onSave={setSelectedIds}
      />
    </fieldset>
  );
}
