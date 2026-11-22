import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

import { formatApplicableUnitLabels } from "@/modules/organisation/applicability-selection";

export function formatApplicableUnitsCompactSummary(
  selectedIds: ReadonlySet<string>,
  units: FlatOrganisationUnit[],
  options: { maxNames?: number; emptyLabel?: string } = {},
): string {
  const maxNames = options.maxNames ?? 2;
  const emptyLabel = options.emptyLabel ?? "No locations selected";
  const labels = formatApplicableUnitLabels(selectedIds, units).sort((a, b) =>
    a.localeCompare(b, "en-GB"),
  );
  if (labels.length === 0) {
    return emptyLabel;
  }
  if (labels.length <= maxNames) {
    return labels.join(", ");
  }
  const shown = labels.slice(0, maxNames).join(", ");
  const more = labels.length - maxNames;
  return `${shown} +${more} more`;
}
