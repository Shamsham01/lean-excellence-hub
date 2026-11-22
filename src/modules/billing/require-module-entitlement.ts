import { redirect } from "next/navigation";

import { loadCurrentOrganisationEntitlements } from "@/modules/billing/load-current-entitlements";
import {
  organisationHasModuleEntitlement,
  type PlanModuleCode,
} from "@/modules/billing/module-entitlements";

export async function requirePlanModuleEntitlement(module: PlanModuleCode) {
  const entitlements = await loadCurrentOrganisationEntitlements();
  if (!organisationHasModuleEntitlement(entitlements, module)) {
    redirect(`/platform/settings/billing?module=${encodeURIComponent(module)}`);
  }
}
