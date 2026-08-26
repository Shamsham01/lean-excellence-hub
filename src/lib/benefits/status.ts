export const BENEFIT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "realising",
  "realised",
  "rejected",
  "withdrawn",
  "cancelled",
] as const;

export type BenefitStatus = (typeof BENEFIT_STATUSES)[number];

const STATUS_LABELS: Record<BenefitStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  realising: "Realising",
  realised: "Realised",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

const STATUS_BADGE_VARIANTS: Record<
  BenefitStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  submitted: "outline",
  approved: "default",
  realising: "default",
  realised: "default",
  rejected: "destructive",
  withdrawn: "secondary",
  cancelled: "secondary",
};

const EDITABLE_STATUSES = new Set<BenefitStatus>(["draft"]);

const LEGAL_TRANSITIONS: Partial<Record<BenefitStatus, BenefitStatus[]>> = {
  draft: ["submitted", "withdrawn", "cancelled"],
  submitted: ["approved", "rejected", "draft", "withdrawn"],
  approved: ["realising", "withdrawn", "cancelled"],
  realising: ["realised", "withdrawn", "cancelled"],
};

export function benefitStatusLabel(status: string): string {
  return STATUS_LABELS[status as BenefitStatus] ?? status;
}

export function benefitStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  return STATUS_BADGE_VARIANTS[status as BenefitStatus] ?? "secondary";
}

export function isBenefitEditable(status: string): boolean {
  return EDITABLE_STATUSES.has(status as BenefitStatus);
}

export function canTransitionBenefitStatus(
  fromStatus: string,
  toStatus: string,
): boolean {
  const allowed = LEGAL_TRANSITIONS[fromStatus as BenefitStatus];
  return allowed?.includes(toStatus as BenefitStatus) ?? false;
}

export function pipelineStatuses(): BenefitStatus[] {
  return ["submitted", "approved", "realising", "realised"];
}

export function portfolioFilterStatuses(): BenefitStatus[] {
  return ["draft", "submitted", "approved", "realising", "realised", "rejected"];
}

export function realisationEntryStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Awaiting Validation";
    case "validated":
      return "Validated";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function realisationEntryStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "validated":
      return "default";
    case "submitted":
      return "outline";
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}
