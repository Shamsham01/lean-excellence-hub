import type { OrganisationEntitlements } from "./types";

export type PlanCapabilityKey =
  | "advancedBenefitsGovernance"
  | "advancedAnalytics"
  | "apiAccess"
  | "integrations";

export const PLAN_CAPABILITY_DB_KEYS: Record<PlanCapabilityKey, string> = {
  advancedBenefitsGovernance: "advanced_benefits_governance",
  advancedAnalytics: "advanced_analytics",
  apiAccess: "api_access",
  integrations: "integrations",
};

export function planCapabilityMessage(capability: PlanCapabilityKey) {
  switch (capability) {
    case "advancedBenefitsGovernance":
      return {
        title: "Finance benefit validation is on Professional",
        description:
          "Essentials includes CI validation and benefit tracking. Finance validation, stronger governance, and the validation queue for finance reviewers require Professional or Founder Pilot.",
      };
    case "advancedAnalytics":
      return {
        title: "Advanced analytics is on Professional",
        description:
          "Essentials includes standard dashboards and exports. Module performance analytics, ageing tables, and trend views require Professional or Founder Pilot.",
      };
    case "apiAccess":
      return {
        title: "API access is on Professional",
        description:
          "Programmatic access and webhooks require Professional, Founder Pilot, or Enterprise.",
      };
    case "integrations":
      return {
        title: "Integrations are on Professional",
        description:
          "Standard business integrations require Professional, Founder Pilot, or Enterprise.",
      };
    default:
      return {
        title: "Upgrade required",
        description: "This capability is not included on your current plan.",
      };
  }
}

export function entitlementCapabilityGranted(
  entitlements: OrganisationEntitlements,
  capability: PlanCapabilityKey,
) {
  return entitlements[capability] === true;
}
