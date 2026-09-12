import type { UnitSelectOption } from "@/modules/organisation/site-context";

type ApplicableUnitsFieldProps = {
  options: UnitSelectOption[];
  selectedIds?: ReadonlySet<string>;
  preservedIds?: readonly string[];
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
};

export function ApplicableUnitsField({
  options,
  selectedIds,
  preservedIds = [],
  requiresSiteSelection = false,
  emptyMessage = "Select an active site in the sidebar before choosing applicable areas.",
}: ApplicableUnitsFieldProps) {
  if (requiresSiteSelection || options.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Applicable areas</p>
        <p
          className="text-sm text-muted-foreground"
          data-testid="site-context-required"
        >
          {requiresSiteSelection
            ? emptyMessage
            : "No organisational units are available."}
        </p>
      </div>
    );
  }

  return (
    <fieldset
      className="flex flex-col gap-2"
      data-testid="applicable-units-field"
    >
      <legend className="text-sm font-medium">Applicable areas</legend>
      {preservedIds.map((id) => (
        <input key={id} type="hidden" name="applicableUnitIds" value={id} />
      ))}
      <div className="mt-1 flex flex-col gap-2">
        {options.map((unit) => (
          <label
            key={unit.id}
            className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="applicableUnitIds"
              value={unit.id}
              defaultChecked={selectedIds?.has(unit.id) ?? false}
              className="size-4"
              data-testid="applicable-unit-checkbox"
            />
            <span>{unit.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
