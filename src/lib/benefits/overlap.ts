export type OverlapSeverity = "none" | "warning" | "critical";

export function formatOverlapWarning(
  allocationPercentage: number,
  peerBenefitNumbers: string[],
): string | null {
  if (allocationPercentage <= 100 || peerBenefitNumbers.length === 0) {
    return null;
  }

  const peers = peerBenefitNumbers.join(", ");
  return `Portfolio allocation exceeds 100% with ${peers}.`;
}

export function overlapSeverity(allocationPercentage: number): OverlapSeverity {
  if (allocationPercentage <= 100) {
    return "none";
  }

  if (allocationPercentage <= 125) {
    return "warning";
  }

  return "critical";
}
