import type { AssistantRelevantState } from "./types";

export type StructureAssistantUnit = {
  id: string;
  parent_unit_id?: string | null;
  status?: string | null;
};

export type StructureAssistantState = {
  relevantState: AssistantRelevantState;
  summary: string;
};

export function formatStructureAssistantSummary(
  activeUnitCount: number,
  childUnitCount: number,
) {
  const unitPhrase =
    activeUnitCount === 1 ? "1 active unit" : `${activeUnitCount} active units`;
  const childPhrase =
    childUnitCount === 0
      ? "no child units"
      : childUnitCount === 1
        ? "1 child unit"
        : `${childUnitCount} child units`;
  return `Your organisation currently has ${unitPhrase} and ${childPhrase}.`;
}

export function buildStructureAssistantState(
  units: readonly StructureAssistantUnit[],
): StructureAssistantState {
  const activeUnits = units.filter((unit) => unit.status !== "retired");
  const childUnitCount = activeUnits.filter((unit) =>
    Boolean(unit.parent_unit_id),
  ).length;
  const archivedUnitCount = units.filter(
    (unit) => unit.status === "retired",
  ).length;

  return {
    relevantState: {
      activeUnitCount: activeUnits.length,
      childUnitCount,
      archivedUnitCount,
    },
    summary: formatStructureAssistantSummary(
      activeUnits.length,
      childUnitCount,
    ),
  };
}
