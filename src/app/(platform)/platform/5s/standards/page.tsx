import { redirect } from "next/navigation";

import { createFiveSStandard } from "@/app/(platform)/platform/5s/actions";
import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { PageHeader } from "@/components/platform/page-header";
import { ModuleReadError } from "@/components/workplace/module-read-error";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FiveSScoringScaleFields } from "@/components/five-s/scoring-scale-fields";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function FiveSStandardsPage() {
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: FIVE_S_PERMISSIONS.read,
    module: "five_s",
    title: "5S",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    FIVE_S_PERMISSIONS.standardsManage,
  );
  const { data: standards, error: standardsError } = await supabase
    .from("five_s_standards")
    .select("id, display_name, description, created_at")
    .order("created_at", { ascending: false });

  if (standardsError) {
    return (
      <ModuleReadError
        title="5S standards"
        description="Configurable audit templates per area."
        message="5S standards could not be loaded. Refresh the page and try again."
        module="five_s"
      />
    );
  }
  const { units, context } = await loadActiveSiteContext();
  const creationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });

  async function createAction(formData: FormData) {
    "use server";
    const result = await createFiveSStandard(formData);
    if (result.error) {
      throw new Error(result.error);
    }
    if (result.standardId) {
      redirect(`/platform/5s/standards/${result.standardId}`);
    }
  }

  return (
    <div className="flex flex-col gap-8" data-testid="five-s-standards-page">
      <PageHeader
        title="5S standards"
        description="Configurable audit templates per area. Setup mode → Draft → Review → Publish."
        actions={
          canManage ? (
            <Button variant="outline" asChild>
              <AppLink
                href="/platform/5s/setup"
                data-testid="five-s-choose-setup"
              >
                Choose how to start
              </AppLink>
            </Button>
          ) : null
        }
      />

      {canManage ? (
        <Card id="create-standard">
          <CardHeader>
            <CardTitle>Create standard</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={createAction}
              className="flex max-w-lg flex-col gap-4"
            >
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  className="mt-2 min-h-11"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="threshold">Pass threshold (%)</Label>
                <Input
                  id="threshold"
                  name="threshold"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={90}
                  className="mt-2"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  The pass mark for the audit result. It is not the scoring
                  range.
                </p>
              </div>
              <FiveSScoringScaleFields idPrefix="create-scoring-scale" saved />
              <ApplicableUnitsField
                options={creationUnits.units}
                requiresSiteSelection={creationUnits.requiresSiteSelection}
              />
              <Button
                type="submit"
                className="min-h-11"
                disabled={creationUnits.units.length === 0}
              >
                Create draft standard
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Standards</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(standards ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "No 5S standards yet. Create a draft and publish it before audits begin."
                : "No 5S standards are available with your access."}
            </p>
          ) : null}
          {standards?.map((s) => (
            <AppLink
              key={s.id}
              href={`/platform/5s/standards/${s.id}`}
              className="rounded-md border border-border px-4 py-3 hover:bg-surface"
              data-testid={`five-s-standard-link-${s.id}`}
            >
              <p className="font-medium">{s.display_name}</p>
              {s.description ? (
                <p className="text-sm text-muted-foreground">{s.description}</p>
              ) : null}
            </AppLink>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
