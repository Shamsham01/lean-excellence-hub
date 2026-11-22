import type { OrganisationEntitlements, PlanCode } from "./types";

/**
 * Canonical module keys for plan gating. RBAC permissions remain required in
 * addition to these entitlements (never grant access from plan alone).
 */
export const PLAN_MODULE_CODES = [
  "maturity",
  "five_s",
  "gemba",
  "actions",
  "suggestions",
  "projects",
  "benefits",
  "problem_solving",
  "training",
  "skills",
  "recognition",
  "people_hr",
  "schedule",
  "templates",
] as const;

export type PlanModuleCode = (typeof PLAN_MODULE_CODES)[number];

export type PlanModuleEntitlements = Record<PlanModuleCode, boolean>;

const ESSENTIALS_MODULES: PlanModuleCode[] = [
  "maturity",
  "five_s",
  "gemba",
  "actions",
  "suggestions",
  "schedule",
  "templates",
];

const PROFESSIONAL_ONLY_MODULES: PlanModuleCode[] = [
  "projects",
  "benefits",
  "problem_solving",
  "training",
  "skills",
  "recognition",
  "people_hr",
];

export function buildPlanModuleEntitlements(input: {
  planCode: PlanCode | null;
  legacyGrandfather: boolean;
}): PlanModuleEntitlements {
  const allTrue = Object.fromEntries(
    PLAN_MODULE_CODES.map((code) => [code, true]),
  ) as PlanModuleEntitlements;

  if (input.legacyGrandfather && input.planCode === null) {
    return allTrue;
  }

  const base = Object.fromEntries(
    PLAN_MODULE_CODES.map((code) => [code, false]),
  ) as PlanModuleEntitlements;

  if (
    input.planCode === "professional" ||
    input.planCode === "founder" ||
    input.planCode === "enterprise"
  ) {
    return allTrue;
  }

  if (input.planCode === "essentials") {
    for (const code of ESSENTIALS_MODULES) {
      base[code] = true;
    }
    return base;
  }

  return base;
}

export function planModuleDbKey(module: PlanModuleCode) {
  return `module_${module}`;
}

export function organisationHasModuleEntitlement(
  entitlements: OrganisationEntitlements,
  module: PlanModuleCode,
) {
  return entitlements.modules[module] === true;
}

export function moduleUpgradeTitle(module: PlanModuleCode) {
  switch (module) {
    case "people_hr":
      return "People HR is on Professional";
    case "benefits":
      return "Benefits is on Professional";
    case "projects":
      return "Projects is on Professional";
    case "problem_solving":
      return "Problem solving is on Professional";
    case "training":
      return "Training is on Professional";
    case "skills":
      return "Skills is on Professional";
    case "recognition":
      return "Recognition is on Professional";
    default:
      return "Upgrade to Professional";
  }
}

export function moduleUpgradeDescription(module: PlanModuleCode) {
  return `Essentials includes Maturity, 5S, Gemba, Actions, and Suggestions with standard dashboards for those modules. ${moduleUpgradeTitle(module)} unlocks the full Operational Excellence module set, higher LeanAI fair-use capacity, and People HR.`;
}
