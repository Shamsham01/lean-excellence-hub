import { revalidatePath } from "next/cache";

import { deployGembaQuickStart } from "../setup/actions";

import { LEH_OPERATIONAL_GEMBA_WALK_KEY } from "@/modules/gemba/templates";

import { definitionRemovalLabel } from "@/modules/operational/gemba-applicability";

import { redirect } from "next/navigation";

import { createGembaDefinition } from "@/app/(platform)/platform/gemba/actions";

import { CompactApplicableUnitsField } from "@/components/organisation/compact-applicable-units-field";

import { PageHeader } from "@/components/platform/page-header";

import { ModuleReadError } from "@/components/workplace/module-read-error";

import { AppLink } from "@/components/ui/app-link";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import {
  buildSiteScopedUnitOptions,
  filterUnitsForActiveSite,
} from "@/modules/organisation/site-context";

import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";

import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";

import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

import { loadWorkplaceModuleView } from "@/modules/workplace/access";

import { createServerSupabaseClient } from "@/platform/supabase/server";

const APPLICABILITY_DESCRIPTION =
  "Choose the exact organisational units where this Gemba definition can be executed or scheduled. Applicability does not grant permission.";

export default async function GembaDefinitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const { create } = await searchParams;

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

  const { data: loadedDefinitions, error: definitionsError } = await supabase

    .from("gemba_definitions")

    .select(
      "id, display_name, gemba_definition_versions(status, version_number, gemba_walks(count)), gemba_definition_applicable_units(unit_id)",
    )

    .is("archived_at", null)

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

  const { data: authorableIds, error: authorableIdsError } = canManage
    ? await supabase.rpc("list_authorable_gemba_definition_ids")
    : { data: null, error: null };

  if (authorableIdsError) {
    return (
      <ModuleReadError
        title="Gemba definitions"

        description="Templates for structured walks."

        message="Gemba definitions could not be loaded. Refresh the page and try again."

        module="gemba"
      />
    );
  }

  const authorableIdSet = new Set(authorableIds ?? []);

  const definitions = canManage
    ? (loadedDefinitions ?? []).filter((definition) =>
        authorableIdSet.has(definition.id),
      )
    : (loadedDefinitions ?? []);

  const { units, context } = await loadActiveSiteContext();

  const creationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });

  const hierarchyUnits = filterUnitsForActiveSite(units, context, {
    requireConcreteSite: true,
  });

  const { data: schedules, error: scheduleError } = canManage
    ? await supabase
        .from("schedule_definitions")
        .select("activity_resource_id")
        .in(
          "activity_resource_id",
          definitions.map((d) => d.id),
        )
    : { data: [], error: null };

  if (scheduleError)
    throw new Error("Schedule references could not be loaded.");

  const scheduled = new Set(schedules?.map((s) => s.activity_resource_id));

  async function remove(id: string) {
    "use server";

    const db = await createServerSupabaseClient();

    const { error } = await db.rpc("remove_gemba_definition", {
      target_definition_id: id,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/platform/gemba");

    revalidatePath("/platform/gemba/definitions");
  }

  async function deploy(form: FormData) {
    "use server";

    const result = await deployGembaQuickStart(form);

    if (result?.error) throw new Error(result.error);
  }

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

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <form action={deploy}>
            <input
              name="templateKey"
              type="hidden"
              value={LEH_OPERATIONAL_GEMBA_WALK_KEY}
            />

            <input
              name="applicableUnitIds"
              type="hidden"
              value={context.activeSiteId ?? ""}
            />

            <Button className="min-h-11" disabled={!context.activeSiteId}>
              Deploy standard template
            </Button>
          </form>

          <Button variant="outline" className="min-h-11" asChild>
            <AppLink href="/platform/gemba/setup/leanai">
              Create with LeanAI
            </AppLink>
          </Button>

          <Button variant="outline" className="min-h-11" asChild>
            <AppLink href="/platform/gemba/definitions?create=manual#create-definition">
              Manual
            </AppLink>
          </Button>
        </div>
      )}

      {canManage && create === "manual" ? (
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

              <CompactApplicableUnitsField
                hierarchyUnits={hierarchyUnits}

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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Name</th>
                  <th>Locations/areas</th>
                  <th>{canManage ? "Edit" : "View"}</th>
                  {canManage && <th>Delete / Archive</th>}
                </tr>
              </thead>

              <tbody>
                {definitions.map((d) => {
                  const versions = d.gemba_definition_versions;

                  const latest = versions.toSorted(
                    (a, b) => b.version_number - a.version_number,
                  )[0];

                  const areas = d.gemba_definition_applicable_units
                    .map((a) => units.find((u) => u.id === a.unit_id)?.name)
                    .filter(Boolean);

                  const removal = definitionRemovalLabel(
                    versions.some((v) =>
                      v.gemba_walks.some((w) => w.count > 0),
                    ),
                    scheduled.has(d.id),
                  );

                  return (
                    <tr key={d.id} className="border-t">
                      <td className="p-2">
                        <AppLink
                          href={"/platform/gemba/definitions/" + d.id}
                          className="inline-flex min-h-11 items-center font-medium"
                        >
                          {d.display_name}
                        </AppLink>{" "}
                        <span className="text-muted-foreground">
                          {latest?.status}
                        </span>
                      </td>

                      <td>{areas.join(", ") || "—"}</td>
                      <td>
                        <Button variant="ghost" className="min-h-11" asChild>
                          <AppLink
                            href={`/platform/gemba/definitions/${d.id}`}
                            data-testid={`gemba-definition-link-${d.id}`}
                          >
                            {canManage ? "Edit" : "View"}
                          </AppLink>
                        </Button>
                      </td>

                      {canManage && (
                        <td>
                          <form action={remove.bind(null, d.id)}>
                            <Button variant="outline" className="min-h-11">
                              {removal}
                            </Button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
