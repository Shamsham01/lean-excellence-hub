import { collectApplicableUnitIds } from "@/modules/organisation/applicability-selection";

export {
  collectApplicableUnitIds,
  collectUnitStatuses,
  formatApplicableUnitLabels,
  formatStaleApplicabilityWarning,
  readApplicableUnitIds,
  requireQuerySuccess,
  splitApplicabilitySelection,
  type ApplicabilitySelection,
} from "@/modules/organisation/applicability-selection";

export function interpretGembaDefinitionLookup(
  error: { message: string } | null | undefined,
  row: { id: string } | null | undefined,
): "not_gemba" | "gemba" {
  if (error) {
    throw new Error(`Failed to load Gemba definition: ${error.message}`);
  }
  return row ? "gemba" : "not_gemba";
}

export function requireGembaApplicableUnitIds(
  error: { message: string } | null | undefined,
  rows: Array<{ unit_id: string }> | null | undefined,
): Set<string> {
  if (error) {
    throw new Error(`Failed to load Gemba applicability: ${error.message}`);
  }
  return collectApplicableUnitIds(rows);
}
