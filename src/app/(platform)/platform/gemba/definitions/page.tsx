import { redirect } from "next/navigation";

import { createGembaDefinition } from "@/app/(platform)/platform/gemba/actions";
import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { PageHeader } from "@/components/platform/page-header";
import { ModuleReadError } from "@/components/workplace/module-read-error";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const APPLICABILITY_DESCRIPTION =
  "Choose the exact organisational units where this Gemba definition can be executed or scheduled. Applicability does not grant permission.";

export default async function GembaDefinitionsPage() {
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: GEMBA_PERMISSIONS.read,
    module: "gemba",
    title: "Gemba",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const { data: definitions, error: definitionsError } = await supabase
    .from("gemba_definitions")
    .select("id, display_name, description")
    .order("created_at", { ascending: false });

  if (definitionsError) {
    return (
      <ModuleReadError
        title="Gemba definitions"
        description="Templates for structured walks."
        message="Gemba definitions could not be loaded. Refresh the page and try again."
        module="gemba"
      />
    );
  }
  const { units, context } = await loadActiveSiteContext();
  const creationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });

  async function createAction(formData: FormData) {
    "use server";
    const result = await createGembaDefinition(formData);
    if (result.definitionId) {
      redirect(`/platform/gemba/definitions/${result.definitionId}`);
    }
  }

  return (
    <div className="flex flex-col gap-8" data-testid="gemba-definitions-page">
      <PageHeader
        title="Gemba definitions"
        description="Templates for structured walks. Setup mode → Draft → Review → Publish."
        actions={
          canManage ? (
            <Button variant="outline" asChild>
              <AppLink
                href="/platform/gemba/setup"
                data-testid="gemba-choose-setup"
              >
                Choose how to start
              </AppLink>
            </Button>
          ) : null
        }
      />
      {canManage ? (
        <Card id="create-definition">
          <CardHeader>
            <CardTitle>Create definition</CardTitle>
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
              <ApplicableUnitsField
                options={creationUnits.units}
                requiresSiteSelection={creationUnits.requiresSiteSelection}
                description={APPLICABILITY_DESCRIPTION}
              />
              <Button
                type="submit"
                className="min-h-11"
                disabled={creationUnits.units.length === 0}
              >
                Create draft
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Definitions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(definitions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "No Gemba definitions yet. Create a draft and publish it before walks begin."
                : "No Gemba definitions are available with your access."}
            </p>
          ) : null}
          {definitions?.map((d) => (
            <AppLink
              key={d.id}
              href={`/platform/gemba/definitions/${d.id}`}
              className="rounded-md border border-border px-4 py-3 hover:bg-surface"
              data-testid={`gemba-definition-link-${d.id}`}
            >
              <p className="font-medium">{d.display_name}</p>
            </AppLink>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
