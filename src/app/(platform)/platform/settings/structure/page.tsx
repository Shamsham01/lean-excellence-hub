import { notFound } from "next/navigation";

import { StructureWorkspace } from "@/components/organisation/structure-workspace";
import { loadCurrentOrganisationBilling } from "@/modules/billing/current-billing";
import { buildSiteCapacityView } from "@/modules/billing/site-capacity";
import {
  buildOrganisationUnitTree,
  summariseOrganisationStructure,
} from "@/modules/organisation/unit-hierarchy";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  createOrganisationUnit,
  moveOrganisationUnit,
  restoreOrganisationUnit,
  retireOrganisationUnit,
  updateOrganisationUnit,
} from "./actions";

async function resolveManageableUnitIds(
  units: Array<{ id: string; status: string }>,
) {
  const activeUnits = units.filter((unit) => unit.status === "active");
  const manageableUnitIds = new Set<string>();

  if (await currentMemberHasOrganisationScopedPermission("hierarchy.manage")) {
    for (const unit of units) {
      manageableUnitIds.add(unit.id);
    }
    return manageableUnitIds;
  }

  for (const unit of activeUnits) {
    if (await currentMemberHasScopedPermission("hierarchy.manage", unit.id)) {
      manageableUnitIds.add(unit.id);
    }
  }

  for (const unit of units) {
    if (
      unit.status === "retired" &&
      (await currentMemberHasScopedPermission("hierarchy.manage", unit.id))
    ) {
      manageableUnitIds.add(unit.id);
    }
  }

  return manageableUnitIds;
}

export default async function StructureSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, code, name, unit_type, parent_unit_id, status")
    .order("name");

  let canRead =
    (await currentMemberHasOrganisationScopedPermission("hierarchy.read")) ||
    (await currentMemberHasPermission("hierarchy.read"));

  if (!canRead) {
    for (const unit of units ?? []) {
      if (await currentMemberHasScopedPermission("hierarchy.read", unit.id)) {
        canRead = true;
        break;
      }
    }
  }

  if (!canRead) {
    notFound();
  }

  const canCreateRoot =
    await currentMemberHasOrganisationScopedPermission("hierarchy.manage");
  const canManageAny =
    (await currentMemberHasOrganisationScopedPermission("hierarchy.manage")) ||
    (await currentMemberHasPermission("hierarchy.manage"));

  const manageableUnitIds = await resolveManageableUnitIds(units ?? []);
  const canManage = canManageAny || manageableUnitIds.size > 0;

  const activeUnits = (units ?? []).filter((unit) => unit.status === "active");
  const retiredUnits = (units ?? []).filter(
    (unit) => unit.status === "retired",
  );
  const tree = buildOrganisationUnitTree(activeUnits);
  const flatUnits = (units ?? []).map((unit) => ({
    id: unit.id,
    name: unit.name,
    code: unit.code,
    unit_type: unit.unit_type,
    parent_unit_id: unit.parent_unit_id,
    status: unit.status,
  }));
  const summary = summariseOrganisationStructure(flatUnits);
  const canAddUnit =
    canCreateRoot || activeUnits.some((unit) => manageableUnitIds.has(unit.id));
  const billing = await loadCurrentOrganisationBilling(supabase);
  const canManageBilling = await currentMemberHasPermission("billing.manage");
  const siteCapacity = billing
    ? buildSiteCapacityView({
        activeSiteCount: billing.active_site_count,
        siteQuantity: billing.site_quantity,
        billingState: billing.billing_state,
        paidSiteLimit: billing.paid_site_limit,
        canManageBilling,
      })
    : null;

  const lifecycleActions = canManage
    ? {
        onUpdate: updateOrganisationUnit,
        onMove: moveOrganisationUnit,
        onRetire: retireOrganisationUnit,
        onRestore: restoreOrganisationUnit,
      }
    : undefined;

  return (
    <StructureWorkspace
      tree={tree}
      flatUnits={flatUnits}
      activeUnits={activeUnits}
      retiredUnits={retiredUnits}
      summary={summary}
      canManage={canManage}
      canCreateRoot={canCreateRoot}
      canAddUnit={canAddUnit}
      manageableUnitIds={[...manageableUnitIds]}
      existingCodes={(units ?? []).map((unit) => unit.code)}
      onCreate={createOrganisationUnit}
      {...(siteCapacity ? { siteCapacity } : {})}
      {...(lifecycleActions ? { lifecycleActions } : {})}
    />
  );
}
