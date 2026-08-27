export const EFFECTIVENESS_RESULTS = ["pass", "fail", "inconclusive"] as const;

export type EffectivenessResult = (typeof EFFECTIVENESS_RESULTS)[number];

const RESULT_LABELS: Record<EffectivenessResult, string> = {
  pass: "Pass",
  fail: "Fail",
  inconclusive: "Inconclusive",
};

const RESULT_BADGE_VARIANTS: Record<
  EffectivenessResult,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pass: "default",
  fail: "destructive",
  inconclusive: "outline",
};

export function effectivenessResultLabel(result: string | null): string {
  if (!result) return "Pending";
  return RESULT_LABELS[result as EffectivenessResult] ?? result;
}

export function effectivenessResultBadgeVariant(
  result: string | null,
): "default" | "secondary" | "outline" | "destructive" {
  if (!result) return "secondary";
  return RESULT_BADGE_VARIANTS[result as EffectivenessResult] ?? "secondary";
}

export const COUNTERMEASURE_STATUSES = [
  "proposed",
  "selected",
  "implemented",
  "effective",
  "ineffective",
  "rejected",
] as const;

export type CountermeasureStatus = (typeof COUNTERMEASURE_STATUSES)[number];

const COUNTERMEASURE_LABELS: Record<CountermeasureStatus, string> = {
  proposed: "Proposed",
  selected: "Selected",
  implemented: "Implemented",
  effective: "Effective",
  ineffective: "Ineffective",
  rejected: "Rejected",
};

export function countermeasureStatusLabel(status: string): string {
  return COUNTERMEASURE_LABELS[status as CountermeasureStatus] ?? status;
}

export const CONTAINMENT_STATUSES = ["proposed", "active", "released"] as const;

export function containmentStatusLabel(status: string): string {
  switch (status) {
    case "proposed":
      return "Proposed";
    case "active":
      return "Active";
    case "released":
      return "Released";
    default:
      return status;
  }
}
