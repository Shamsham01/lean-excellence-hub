import {
  formatUnitPath,
  type FlatOrganisationUnit,
} from "@/modules/organisation/unit-hierarchy";

export type SkillsSetupUnitOption = {
  id: string;
  name: string;
  path: string;
};

export const skillsSetupSelectClass =
  "border-input box-border h-11 w-full max-w-full min-w-0 rounded-md border bg-background px-3 text-sm";

export const skillsSetupWrappingTextClass =
  "block w-full max-w-full min-w-0 [overflow-wrap:anywhere]";

export function skillsSetupUnitOptions(
  units: ReadonlyArray<{
    id: string;
    name: string;
    parent_unit_id?: string | null;
  }>,
): SkillsSetupUnitOption[] {
  const flat: FlatOrganisationUnit[] = units.map((unit) => ({
    id: unit.id,
    code: unit.id,
    name: unit.name,
    parent_unit_id: unit.parent_unit_id ?? null,
  }));

  return flat
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      path: formatUnitPath(unit.id, flat),
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en-GB"));
}
