import type { UnitSelectOption } from "@/modules/organisation/site-context";

type ApplicableUnitsFieldProps = {
  options: UnitSelectOption[];
  selectedIds?: ReadonlySet<string>;
  preservedIds?: readonly string[];
  staleWarning?: string | null;
  staleWarningTestId?: string;
  requiresSiteSelection?: boolean;
  emptyMessage?: string;
  description?: string;
};

export function ApplicableUnitsField({
  options,
  selectedIds,
  preservedIds = [],
  staleWarning = null,
  staleWarningTestId = "five-s-stale-applicability-warning",
  requiresSiteSelection = false,
  emptyMessage = "Select an active site in the sidebar before choosing applicable areas.",
  description,
}: ApplicableUnitsFieldProps) {
  if (requiresSiteSelection || options.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {preservedIds.map((id) => (
          <input key={id} type="hidden" name="applicableUnitIds" value={id} />
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

  return (
    <fieldset
      className="flex flex-col gap-2"
      data-testid="applicable-units-field"
    >
      <legend className="text-sm font-medium">Applicable areas</legend>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {preservedIds.map((id) => (
        <input key={id} type="hidden" name="applicableUnitIds" value={id} />
      ))}
      {staleWarning ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid={staleWarningTestId}
        >
          {staleWarning}
        </p>
      ) : null}
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
