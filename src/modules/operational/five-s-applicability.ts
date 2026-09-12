import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

export function collectApplicableUnitIds(
  rows: Array<{ unit_id: string }> | null | undefined,
): Set<string> {
  return new Set((rows ?? []).map((row) => row.unit_id));
}

export function readApplicableUnitIds(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll("applicableUnitIds")
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

export function splitApplicabilitySelection(
  applicableIds: ReadonlySet<string>,
  visibleOptions: ReadonlyArray<{ id: string }>,
): { selectedIds: Set<string>; preservedIds: string[] } {
  const visible = new Set(visibleOptions.map((option) => option.id));
  const selectedIds = new Set<string>();
  const preservedIds: string[] = [];

  for (const id of applicableIds) {
    if (visible.has(id)) {
      selectedIds.add(id);
    } else {
      preservedIds.push(id);
    }
  }

  return { selectedIds, preservedIds };
}

export function formatApplicableUnitLabels(
  applicableIds: ReadonlySet<string>,
  units: FlatOrganisationUnit[],
): string[] {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const visibleUnits = [...applicableIds]
    .map((id) => byId.get(id))
    .filter((unit): unit is FlatOrganisationUnit => Boolean(unit));
  const names = visibleUnits.map((unit) => unit.name);
  const duplicateNames = new Set(
    names.filter((name, index) => names.indexOf(name) !== index),
  );

  return visibleUnits.map((unit) =>
    duplicateNames.has(unit.name) ? formatUnitPath(unit.id, units) : unit.name,
  );
}
