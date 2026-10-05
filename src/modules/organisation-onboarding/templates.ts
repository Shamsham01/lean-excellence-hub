import { suggestOrganisationUnitCode } from "@/modules/organisation-setup/unit-code";

import type { JobFunctionSuggestion, StructureDraftUnit } from "./types";

function draftUnit(
  name: string,
  unitType: string,
  children: StructureDraftUnit[] = [],
): StructureDraftUnit {
  return {
    localId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    unitType,
    children,
  };
}

export const COMMON_MANUFACTURING_STRUCTURE: StructureDraftUnit[] = [
  draftUnit("Production", "department", [
    draftUnit("Line 1", "line"),
    draftUnit("Line 2", "line"),
    draftUnit("Packing", "area"),
  ]),
  draftUnit("Engineering", "department"),
  draftUnit("Quality", "department"),
  draftUnit("Warehouse", "department"),
  draftUnit("Technical", "department"),
  draftUnit("H&S", "department"),
  draftUnit("Continuous Improvement", "department"),
];

export const JOB_FUNCTION_SUGGESTIONS: JobFunctionSuggestion[] = [
  {
    name: "Site Director",
    code: "site-director",
    description: "Accountable for site performance and operating standards.",
  },
  {
    name: "CI Manager",
    code: "ci-manager",
    description: "Leads continuous improvement across the site.",
  },
  {
    name: "Production Manager",
    code: "production-manager",
    description: "Owns production performance and daily management.",
  },
  {
    name: "Area Leader",
    code: "area-leader",
    description: "Leads an area or value-stream section.",
  },
  {
    name: "Team Leader",
    code: "team-leader",
    description: "Leads a frontline team.",
  },
  {
    name: "Operator",
    code: "operator",
    description: "Performs the core operational work of the site.",
  },
  {
    name: "Engineer",
    code: "engineer",
    description: "Provides technical and equipment support.",
  },
  {
    name: "Quality Technician",
    code: "quality-technician",
    description: "Supports quality standards, checks and containment.",
  },
];

export const MODULE_HANDOFF_CARDS = [
  {
    key: "maturity",
    title: "Maturity",
    href: "/platform/maturity",
    why: "Use your organisation structure when defining assessment scope.",
  },
  {
    key: "suggestions",
    title: "Suggestions",
    href: "/platform/suggestions",
    why: "Use units and people to route improvement ideas.",
  },
  {
    key: "gemba",
    title: "Gemba",
    href: "/platform/gemba",
    why: "Anchor walks to the areas and teams you have just described.",
  },
  {
    key: "five_s",
    title: "5S",
    href: "/platform/5s",
    why: "Apply workplace standards to the units that actually exist.",
  },
  {
    key: "training",
    title: "Training & Skills",
    href: "/platform/training/courses",
    why: "Use job functions to define capability requirements.",
  },
] as const;

export function cloneManufacturingStructureDraft(): StructureDraftUnit[] {
  return structuredClone(COMMON_MANUFACTURING_STRUCTURE);
}

export function countDraftUnits(units: readonly StructureDraftUnit[]): number {
  return units.reduce(
    (total, unit) => total + 1 + countDraftUnits(unit.children),
    0,
  );
}

export function flattenDraftUnits(
  units: readonly StructureDraftUnit[],
  parentLocalId: string | null = null,
): Array<{
  localId: string;
  parentLocalId: string | null;
  name: string;
  unitType: string;
}> {
  return units.flatMap((unit) => [
    {
      localId: unit.localId,
      parentLocalId,
      name: unit.name,
      unitType: unit.unitType,
    },
    ...flattenDraftUnits(unit.children, unit.localId),
  ]);
}

export function suggestUniqueUnitCode(
  name: string,
  existingCodes: readonly string[],
) {
  return suggestOrganisationUnitCode(name, existingCodes);
}

export function unusedJobFunctionSuggestions(existingCodes: readonly string[]) {
  const taken = new Set(existingCodes.map((code) => code.trim().toLowerCase()));
  return JOB_FUNCTION_SUGGESTIONS.filter(
    (suggestion) => !taken.has(suggestion.code),
  );
}
