import {
  formatApplicableUnitLabels,
  requireApplicableUnitIds,
  splitApplicabilitySelection,
} from "@/modules/operational/five-s-applicability";
import {
  buildSiteScopedUnitOptions,
  filterUnitsForActiveSite,
} from "@/modules/organisation/site-context";

export type SchedulableActivityKind = "five_s" | "gemba";

export type SchedulableActivityOption = {
  kind: SchedulableActivityKind;
  id: string;
  displayName: string;
  applicabilitySummary: string;
};

function summarizeApplicability(
  applicableUnitIds: Set<string>,
  configurationUnits: ReturnType<typeof buildSiteScopedUnitOptions>,
  unitStatusById: Map<string, string>,
  hierarchyUnits: ReturnType<typeof filterUnitsForActiveSite>,
): string | null {
  const applicabilitySelection = splitApplicabilitySelection(
    applicableUnitIds,
    configurationUnits.units,
    unitStatusById,
  );
  if (applicabilitySelection.confirmedActiveIds.size === 0) {
    return null;
  }
  const labels = formatApplicableUnitLabels(
    applicabilitySelection.confirmedActiveIds,
    hierarchyUnits,
  );
  if (labels.length === 0) {
    return "Applicable areas configured";
  }
  if (labels.length <= 3) {
    return labels.join(", ");
  }
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`;
}

export function buildSchedulableFiveSOptions(
  standards: Array<{ id: string; display_name: string }>,
  publishedStandardIds: ReadonlySet<string>,
  applicabilityByStandard: ReadonlyMap<string, string[]>,
  unitStatusById: Map<string, string>,
  configurationUnits: ReturnType<typeof buildSiteScopedUnitOptions>,
  hierarchyUnits: ReturnType<typeof filterUnitsForActiveSite>,
): SchedulableActivityOption[] {
  const options: SchedulableActivityOption[] = [];

  for (const standard of standards) {
    if (!publishedStandardIds.has(standard.id)) {
      continue;
    }

    let applicableIds: Set<string>;
    try {
      applicableIds = requireApplicableUnitIds(
        null,
        (applicabilityByStandard.get(standard.id) ?? []).map((unitId) => ({
          unit_id: unitId,
        })),
      );
    } catch {
      continue;
    }

    const summary = summarizeApplicability(
      applicableIds,
      configurationUnits,
      unitStatusById,
      hierarchyUnits,
    );
    if (!summary) {
      continue;
    }

    options.push({
      kind: "five_s",
      id: standard.id,
      displayName: standard.display_name,
      applicabilitySummary: summary,
    });
  }

  return options;
}

export function buildSchedulableGembaOptions(
  definitions: Array<{ id: string; display_name: string }>,
  publishedDefinitionIds: ReadonlySet<string>,
  applicabilityByDefinition: ReadonlyMap<string, string[]>,
  unitStatusById: Map<string, string>,
  configurationUnits: ReturnType<typeof buildSiteScopedUnitOptions>,
  hierarchyUnits: ReturnType<typeof filterUnitsForActiveSite>,
): SchedulableActivityOption[] {
  const options: SchedulableActivityOption[] = [];

  for (const definition of definitions) {
    if (!publishedDefinitionIds.has(definition.id)) {
      continue;
    }

    let applicableIds: Set<string>;
    try {
      applicableIds = requireApplicableUnitIds(
        null,
        (applicabilityByDefinition.get(definition.id) ?? []).map((unitId) => ({
          unit_id: unitId,
        })),
      );
    } catch {
      continue;
    }

    const summary = summarizeApplicability(
      applicableIds,
      configurationUnits,
      unitStatusById,
      hierarchyUnits,
    );
    if (!summary) {
      continue;
    }

    options.push({
      kind: "gemba",
      id: definition.id,
      displayName: definition.display_name,
      applicabilitySummary: summary,
    });
  }

  return options;
}

export function mergeSchedulableActivityOptions(
  fiveS: SchedulableActivityOption[],
  gemba: SchedulableActivityOption[],
): SchedulableActivityOption[] {
  return [...fiveS, ...gemba].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    }),
  );
}
