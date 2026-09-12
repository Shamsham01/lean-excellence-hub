import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

export function collectApplicableUnitIds(
  rows: Array<{ unit_id: string }> | null | undefined,
): Set<string> {
  return new Set((rows ?? []).map((row) => row.unit_id));
}

export function requireQuerySuccess<T>(
  error: { message: string } | null | undefined,
  data: T,
  context: string,
): T {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
  return data;
}

export function interpretFiveSStandardLookup(
  error: { message: string } | null | undefined,
  row: { id: string } | null | undefined,
): "not_five_s" | "five_s" {
  if (error) {
    throw new Error(`Failed to load 5S standard: ${error.message}`);
  }
  return row ? "five_s" : "not_five_s";
}

export function requireApplicableUnitIds(
  error: { message: string } | null | undefined,
  rows: Array<{ unit_id: string }> | null | undefined,
): Set<string> {
  if (error) {
    throw new Error(`Failed to load 5S applicability: ${error.message}`);
  }
  return collectApplicableUnitIds(rows);
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

export function collectUnitStatuses(
  rows: Array<{ id: string; status: string }> | null | undefined,
): Map<string, string> {
  return new Map((rows ?? []).map((row) => [row.id, row.status]));
}

export type ApplicabilitySelection = {
  selectedIds: Set<string>;
  preservedIds: string[];
  staleInactiveIds: string[];
  confirmedActiveIds: Set<string>;
};

export function splitApplicabilitySelection(
  applicableIds: ReadonlySet<string>,
  visibleOptions: ReadonlyArray<{ id: string }>,
  unitStatusById: ReadonlyMap<string, string> = new Map(),
): ApplicabilitySelection {
  const visible = new Set(visibleOptions.map((option) => option.id));
  const selectedIds = new Set<string>();
  const preservedIds: string[] = [];
  const staleInactiveIds: string[] = [];
  const confirmedActiveIds = new Set<string>();

  for (const id of applicableIds) {
    const status = unitStatusById.get(id);
    if (status && status !== "active") {
      staleInactiveIds.push(id);
      continue;
    }

    if (status === "active") {
      confirmedActiveIds.add(id);
    }

    if (visible.has(id)) {
      selectedIds.add(id);
    } else {
      // Active off-site mappings, and mappings whose unit row is RLS-hidden,
      // stay preserved so Save cannot silently drop them.
      preservedIds.push(id);
    }
  }

  return {
    selectedIds,
    preservedIds,
    staleInactiveIds,
    confirmedActiveIds,
  };
}

export function formatStaleApplicabilityWarning(
  staleCount: number,
): string | null {
  if (staleCount <= 0) return null;
  if (staleCount === 1) {
    return "1 previously applicable area is inactive and will be removed when you save.";
  }
  return `${staleCount} previously applicable areas are inactive and will be removed when you save.`;
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
