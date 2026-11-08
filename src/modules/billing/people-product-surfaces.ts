import type { PlanModuleCode } from "./module-entitlements";

/**
 * Foundational people administration (invitations, membership visibility) is
 * available on every plan with RBAC. Paid People HR is a Professional module.
 */
export const PEOPLE_FOUNDATION_ROUTE_PREFIXES = [
  "/platform/settings/people",
  "/platform/people/me",
] as const;

/** Paths that require `people_hr` module entitlement (in addition to RBAC). */
/** Job functions + org structure stay on all plans (5S/Gemba/Actions/invites depend on them). */
export const PEOPLE_HR_ROUTE_PREFIXES = [
  "/platform/settings/people/import",
  "/platform/people/", // membership HR admin lives under .../admin (layout-gated)
] as const;

export const PEOPLE_HR_PAID_MODULE: PlanModuleCode = "people_hr";
