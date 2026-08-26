export type BenefitValidationDecision =
  | "approve"
  | "reject"
  | "needs_more_information";

export type BenefitValidationRole = "ci" | "finance";

export type BenefitValidationState =
  | "not_submitted"
  | "awaiting_ci"
  | "awaiting_finance"
  | "fully_approved"
  | "rejected"
  | "needs_more_information";

export function validationDecisionLabel(decision: string): string {
  switch (decision) {
    case "approve":
      return "Approved";
    case "reject":
      return "Rejected";
    case "needs_more_information":
      return "Needs More Information";
    default:
      return decision;
  }
}

export function validationRoleLabel(role: string): string {
  return role === "finance" ? "Finance" : "CI";
}

export function deriveBenefitValidationState(input: {
  benefitStatus: string;
  benefitClass: string;
  ciDecision?: string | null;
  financeDecision?: string | null;
}): BenefitValidationState {
  if (input.benefitStatus === "rejected" || input.financeDecision === "reject" || input.ciDecision === "reject") {
    return "rejected";
  }

  if (input.ciDecision === "needs_more_information" || input.financeDecision === "needs_more_information") {
    return "needs_more_information";
  }

  if (input.benefitStatus === "draft") {
    return "not_submitted";
  }

  if (input.benefitStatus === "submitted") {
    if (input.ciDecision !== "approve") {
      return "awaiting_ci";
    }

    if (input.benefitClass === "financial" && input.financeDecision !== "approve") {
      return "awaiting_finance";
    }

    return "awaiting_finance";
  }

  return "fully_approved";
}

export function validationStateLabel(state: BenefitValidationState): string {
  switch (state) {
    case "not_submitted":
      return "Not Submitted";
    case "awaiting_ci":
      return "Awaiting CI Validation";
    case "awaiting_finance":
      return "Awaiting Finance Validation";
    case "fully_approved":
      return "Fully Approved";
    case "rejected":
      return "Rejected";
    case "needs_more_information":
      return "Needs More Information";
    default:
      return state;
  }
}
