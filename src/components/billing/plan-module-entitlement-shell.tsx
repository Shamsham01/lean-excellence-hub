import type { ReactNode } from "react";

import { PlanModuleUpgradePlaceholder } from "@/components/billing/plan-module-upgrade-placeholder";
import { ModuleWriteEntitlementProvider } from "@/modules/billing/module-write-context";
import { loadCurrentOrganisationEntitlements } from "@/modules/billing/load-current-entitlements";
import {
  organisationHasModuleEntitlement,
  type PlanModuleCode,
} from "@/modules/billing/module-entitlements";

/**
 * Downgrade-safe module shell: historical records stay visible; only new writes
 * should be blocked in client/server actions (see assertPlanModuleWrite).
 */
export async function PlanModuleEntitlementShell({
  module,
  children,
}: {
  module: PlanModuleCode;
  children: ReactNode;
}) {
  const entitlements = await loadCurrentOrganisationEntitlements();
  const writeAllowed = organisationHasModuleEntitlement(entitlements, module);

  return (
    <div
      className="flex flex-col gap-6"
      data-module={module}
      data-module-write-allowed={writeAllowed ? "true" : "false"}
    >
      {!writeAllowed ? (
        <PlanModuleUpgradePlaceholder module={module} />
      ) : null}
      <ModuleWriteEntitlementProvider writeAllowed={writeAllowed}>
        {children}
      </ModuleWriteEntitlementProvider>
    </div>
  );
}
