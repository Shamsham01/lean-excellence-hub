export const FINANCIAL_TYPES = [
  "hard_saving",
  "soft_saving",
  "cost_avoidance",
  "revenue_gain",
  "other_financial",
] as const;

export const NON_FINANCIAL_TYPES = [
  "quality",
  "delivery",
  "safety",
  "people",
  "sustainability",
  "other_non_financial",
] as const;

export type FinancialType = (typeof FINANCIAL_TYPES)[number];
export type NonFinancialType = (typeof NON_FINANCIAL_TYPES)[number];

const FINANCIAL_TYPE_LABELS: Record<FinancialType, string> = {
  hard_saving: "Hard Saving",
  soft_saving: "Soft Saving",
  cost_avoidance: "Cost Avoidance",
  revenue_gain: "Revenue Gain",
  other_financial: "Other Financial",
};

const NON_FINANCIAL_TYPE_LABELS: Record<NonFinancialType, string> = {
  quality: "Quality",
  delivery: "Delivery",
  safety: "Safety",
  people: "People",
  sustainability: "Sustainability",
  other_non_financial: "Other Non-Financial",
};

export function isFinancialBenefit(benefitClass: string): boolean {
  return benefitClass === "financial";
}

export function benefitClassLabel(benefitClass: string): string {
  return benefitClass === "financial" ? "Financial" : "Non-Financial";
}

export function financialTypeLabel(financialType: string): string {
  return FINANCIAL_TYPE_LABELS[financialType as FinancialType] ?? financialType;
}

export function nonFinancialTypeLabel(nonFinancialType: string): string {
  return (
    NON_FINANCIAL_TYPE_LABELS[nonFinancialType as NonFinancialType] ??
    nonFinancialType
  );
}

export function benefitTypeLabel(
  benefitClass: string,
  financialType: string | null,
  nonFinancialType: string | null,
): string {
  if (isFinancialBenefit(benefitClass)) {
    return financialType ? financialTypeLabel(financialType) : "Financial";
  }

  return nonFinancialType
    ? nonFinancialTypeLabel(nonFinancialType)
    : "Non-Financial";
}

export function classificationSummary(
  benefitClass: string,
  financialType: string | null,
  nonFinancialType: string | null,
): string {
  return benefitTypeLabel(benefitClass, financialType, nonFinancialType);
}

export function classificationBadgeVariant(
  benefitClass: string,
): "default" | "secondary" | "outline" {
  return isFinancialBenefit(benefitClass) ? "default" : "outline";
}
