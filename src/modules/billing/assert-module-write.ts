import { loadCurrentOrganisationEntitlements } from "@/modules/billing/load-current-entitlements";
import {
  moduleUpgradeTitle,
  organisationHasModuleEntitlement,
  type PlanModuleCode,
} from "@/modules/billing/module-entitlements";

export type ModuleWriteDenial = {
  ok: false;
  error: string;
  module: PlanModuleCode;
};

export async function assertPlanModuleWrite(
  module: PlanModuleCode,
): Promise<{ ok: true } | ModuleWriteDenial> {
  const entitlements = await loadCurrentOrganisationEntitlements();
  if (!organisationHasModuleEntitlement(entitlements, module)) {
    return {
      ok: false,
      module,
      error: `${moduleUpgradeTitle(module)}. Upgrade billing to start new work here.`,
    };
  }
  return { ok: true };
}
