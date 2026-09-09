import Link from "next/link";
import { notFound } from "next/navigation";

import { OrganisationUnitTree } from "@/components/organisation/organisation-unit-tree";
import { UnitCreateForm } from "@/components/organisation/unit-create-form";
import { UnitLifecycleActions } from "@/components/organisation/unit-lifecycle-actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildOrganisationUnitTree } from "@/modules/organisation/unit-hierarchy";
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

  const lifecycleActions = canManage
    ? {
        onUpdate: updateOrganisationUnit,
        onMove: moveOrganisationUnit,
        onRetire: retireOrganisationUnit,
        onRestore: restoreOrganisationUnit,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-8" data-testid="structure-settings-page">
      <PageHeader
        title="Organisation structure"
        description="Manage units that reflect how your organisation operates. Units keep stable identifiers; archive instead of delete."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active units</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganisationUnitTree
            nodes={tree}
            flatUnits={flatUnits}
            canManage={canManage}
            canCreateRoot={canCreateRoot}
            manageableUnitIds={[...manageableUnitIds]}
            {...(lifecycleActions ? { lifecycleActions } : {})}
          />
        </CardContent>
      </Card>

      {retiredUnits.length > 0 ? (
        <Card data-testid="archived-units-section">
          <CardHeader>
            <CardTitle className="text-base">Archived units</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {retiredUnits.map((unit) => (
              <div
                key={unit.id}
                className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3 text-sm"
                data-testid={`archived-unit-${unit.id}`}
              >
                <div>
                  <p className="font-medium text-foreground">{unit.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {unit.unit_type}
                    {unit.code ? ` · ${unit.code}` : ""}
                  </p>
                </div>
                {manageableUnitIds.has(unit.id) ? (
                  <UnitLifecycleActions
                    unit={{
                      id: unit.id,
                      name: unit.name,
                      code: unit.code,
                      unit_type: unit.unit_type,
                      parent_unit_id: unit.parent_unit_id,
                      status: unit.status,
                    }}
                    activeUnits={activeUnits}
                    canCreateRoot={canCreateRoot}
                    onUpdate={updateOrganisationUnit}
                    onMove={moveOrganisationUnit}
                    onRetire={retireOrganisationUnit}
                    onRestore={restoreOrganisationUnit}
                  />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create unit</CardTitle>
          </CardHeader>
          <CardContent>
            <UnitCreateForm
              units={activeUnits.map((unit) => ({
                id: unit.id,
                name: unit.name,
                code: unit.code,
                parent_unit_id: unit.parent_unit_id,
              }))}
              canCreateRoot={canCreateRoot}
              onCreate={createOrganisationUnit}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask an Organisation Administrator to create organisational units.
        </p>
      )}
    </div>
  );
}
