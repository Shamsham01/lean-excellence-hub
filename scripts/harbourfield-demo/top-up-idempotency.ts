import type { UnitMap } from "./foundation";

export function shouldCreateSuggestionQualityCategory(
  existingCount: number | null | undefined,
): boolean {
  return (existingCount ?? 0) === 0;
}

export type InProgressFormalMaturityStatus =
  "draft" | "in_progress" | "submitted" | "in_review";

export type MaturityFormalCompletionRpc =
  | "submit_maturity_assessment"
  | "begin_assessor_review"
  | "approve_maturity_assessment";

export function maturityFormalCompletionRpcs(
  status: InProgressFormalMaturityStatus | undefined,
): MaturityFormalCompletionRpc[] {
  const effective = status ?? "in_progress";
  switch (effective) {
    case "draft":
    case "in_progress":
      return [
        "submit_maturity_assessment",
        "begin_assessor_review",
        "approve_maturity_assessment",
      ];
    case "submitted":
      return ["begin_assessor_review", "approve_maturity_assessment"];
    case "in_review":
      return ["approve_maturity_assessment"];
    default:
      return [];
  }
}

export function resolveHarbourfieldStorylineUnits(unitIds: UnitMap): {
  lineUnitId: string;
  siteUnitId: string;
} {
  const lineUnitId = unitIds["packing-line-1"] ?? unitIds.packing;
  const siteUnitId = unitIds["bodmin-bakery"] ?? lineUnitId;

  if (!lineUnitId || !siteUnitId) {
    throw new Error(
      "Harbourfield demo top-up requires bodmin-bakery and packing (or packing-line-1) units.",
    );
  }

  return { lineUnitId, siteUnitId };
}

export function hasHostedHarbourfieldAdminCredentials(options: {
  email?: string | undefined;
  password?: string | undefined;
}): options is { email: string; password: string } {
  return Boolean(options.email && options.password);
}
