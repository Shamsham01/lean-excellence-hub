import Link from "next/link";
import { notFound } from "next/navigation";

import { OrganisationUnitTree } from "@/components/organisation/organisation-unit-tree";
import { UnitCreateForm } from "@/components/organisation/unit-create-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildOrganisationUnitTree } from "@/modules/organisation/unit-hierarchy";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { createOrganisationUnit } from "./actions";

export default async function StructureSettingsPage() {
  const canRead = await currentMemberHasPermission("hierarchy.read");
  if (!canRead) {
    notFound();
  }

  const canCreateRoot =
    await currentMemberHasOrganisationScopedPermission("hierarchy.manage");
  const canManage = await currentMemberHasPermission("hierarchy.manage");

  const supabase = await createServerSupabaseClient();
  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, code, name, unit_type, parent_unit_id, status")
    .eq("status", "active")
    .order("name");

  const tree = buildOrganisationUnitTree(units ?? []);

  return (
    <div className="flex flex-col gap-8" data-testid="structure-settings-page">
      <PageHeader
        title="Organisation structure"
        description="Create units that reflect how your organisation operates. Parent and child relationships are shown as a hierarchy."
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
          <OrganisationUnitTree nodes={tree} />
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create unit</CardTitle>
          </CardHeader>
          <CardContent>
            <UnitCreateForm
              units={(units ?? []).map((unit) => ({
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
