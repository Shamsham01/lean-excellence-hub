export function formatFiveSAuditStatus(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return status.replaceAll("_", " ");
}

const SCORE_BAND_LABELS = new Map([
  ["below_standard", "Below standard"],
  ["at_standard", "At standard"],
  ["meets_standard", "Meets standard"],
  ["above_standard", "Above standard"],
  ["unknown", "Unknown"],
]);

export function formatFiveSAuditScoreBand(
  status: string | null,
): string | null {
  if (!status) return null;

  const words = status.replaceAll("_", " ");
  return (
    SCORE_BAND_LABELS.get(status) ??
    words.charAt(0).toUpperCase() + words.slice(1)
  );
}
