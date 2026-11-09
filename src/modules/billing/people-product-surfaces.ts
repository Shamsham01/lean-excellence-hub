import type { PlanModuleCode } from "./module-entitlements";

/**
 * Foundational people administration (invitations, membership visibility,
 * workforce create, CSV identity import) is available on every plan with RBAC.
 * Paid People HR is credential export and advanced membership HR admin.
 */
export const PEOPLE_FOUNDATION_ROUTE_PREFIXES = [
  "/platform/settings/people",
  "/platform/settings/people/create",
  "/platform/settings/people/import",
  "/platform/people/me",
] as const;

/** Paths that require `people_hr` module entitlement (in addition to RBAC). */
export const PEOPLE_HR_ROUTE_PREFIXES = [
  "/platform/people/", // membership HR admin lives under .../admin (layout-gated)
] as const;

export const PEOPLE_HR_PAID_MODULE: PlanModuleCode = "people_hr";
