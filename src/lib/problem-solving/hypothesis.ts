export const HYPOTHESIS_STATUSES = [
  "proposed",
  "testing",
  "supported",
  "verified",
  "rejected",
  "superseded",
] as const;

export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

const STATUS_LABELS: Record<HypothesisStatus, string> = {
  proposed: "Proposed",
  testing: "Testing",
  supported: "Supported",
  verified: "Verified cause",
  rejected: "Rejected",
  superseded: "Superseded",
};

const STATUS_BADGE_VARIANTS: Record<
  HypothesisStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  proposed: "secondary",
  testing: "outline",
  supported: "outline",
  verified: "default",
  rejected: "destructive",
  superseded: "secondary",
};

export const HYPOTHESIS_CATEGORIES = [
  "man",
  "machine",
  "material",
  "method",
  "measurement",
  "environment",
  "other",
] as const;

export type HypothesisCategory = (typeof HYPOTHESIS_CATEGORIES)[number];

const CATEGORY_LABELS: Record<HypothesisCategory, string> = {
  man: "Man",
  machine: "Machine",
  material: "Material",
  method: "Method",
  measurement: "Measurement",
  environment: "Environment",
  other: "Other",
};

export function hypothesisStatusLabel(status: string): string {
  return STATUS_LABELS[status as HypothesisStatus] ?? status;
}

export function hypothesisStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  return STATUS_BADGE_VARIANTS[status as HypothesisStatus] ?? "secondary";
}

export function hypothesisCategoryLabel(category: string | null): string {
  if (!category) return "—";
  return CATEGORY_LABELS[category as HypothesisCategory] ?? category;
}

export const HYPOTHESIS_TEST_CONCLUSIONS = [
  "supports",
  "refutes",
  "inconclusive",
] as const;

export function hypothesisTestConclusionLabel(conclusion: string | null): string {
  if (!conclusion) return "—";
  switch (conclusion) {
    case "supports":
      return "Supports";
    case "refutes":
      return "Refutes";
    case "inconclusive":
      return "Inconclusive";
    default:
      return conclusion;
  }
}
