import Link from "next/link";
import { notFound } from "next/navigation";

import { UnitCreateForm } from "@/components/organisation/unit-create-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="flex flex-col gap-8" data-testid="structure-settings-page">
      <PageHeader
        title="Organisation structure"
        description="Create units that reflect how your organisation operates."
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
          {units?.length ? (
            <ul className="flex flex-col gap-2">
              {units.map((unit) => (
                <li
                  key={unit.id}
                  className="flex flex-col gap-0.5 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{unit.name}</p>
                    <p className="text-muted-foreground">
                      {unit.code} · {unit.unit_type}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No organisational units yet. Create your first unit to complete
              core setup.
            </p>
          )}
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
