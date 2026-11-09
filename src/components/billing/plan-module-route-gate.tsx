import type { ReactNode } from "react";

import { PlanModuleUpgradePlaceholder } from "@/components/billing/plan-module-upgrade-placeholder";
import { loadCurrentOrganisationEntitlements } from "@/modules/billing/load-current-entitlements";
import {
  organisationHasModuleEntitlement,
  type PlanModuleCode,
} from "@/modules/billing/module-entitlements";

export async function PlanModuleRouteGate({
  module,
  children,
}: {
  module: PlanModuleCode;
  children: ReactNode;
}) {
  const entitlements = await loadCurrentOrganisationEntitlements();
  const entitled = organisationHasModuleEntitlement(entitlements, module);

  if (!entitled) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PlanModuleUpgradePlaceholder module={module} />
      </div>
    );
  }

  return children;
}
