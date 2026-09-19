import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addGembaQuestionFromForm,
  addGembaSectionFromForm,
  createGembaDefinitionSuccessorFromForm,
  publishGembaDefinitionFromForm,
  setGembaDefinitionApplicableUnitsFromForm,
  startGembaWalkFromForm,
} from "@/app/(platform)/platform/gemba/actions";
import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { ExecutionUnitStartForm } from "@/components/organisation/execution-unit-start-form";
import { PublishedExecutionHeader } from "@/components/organisation/published-execution-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  collectUnitStatuses,
  formatApplicableUnitLabels,
  formatStaleApplicabilityWarning,
  requireGembaApplicableUnitIds,
  requireQuerySuccess,
  splitApplicabilitySelection,
} from "@/modules/operational/gemba-applicability";
import { formatGembaVersionStatus } from "@/modules/operational/gemba-display";
import {
  GEMBA_PERMISSIONS,
  SCHEDULE_PERMISSIONS,
} from "@/modules/operational/permissions";
import {
  isTemplateAuthoringPublishReady,
  loadTemplateAuthoringChildren,
} from "@/modules/operational/template-authoring";
import {
  buildApplicableSiteScopedUnitOptions,
  buildSiteScopedUnitOptions,
} from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const APPLICABILITY_DESCRIPTION =
  "Applicability controls where this Gemba definition can be executed or scheduled. It does not grant permission.";

export default async function GembaDefinitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const canSchedule = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );

  const { data: definition, error: definitionError } = await supabase
    .from("gemba_definitions")
    .select("id, display_name, description")
    .eq("id", id)
    .maybeSingle();

  requireQuerySuccess(
    definitionError,
    definition,
    "Failed to load Gemba definition",
  );
  if (!definition) notFound();

  const { data: versions, error: versionsError } = await supabase
    .from("gemba_definition_versions")
    .select("id, version_number, status, template_version_id")
    .eq("definition_id", id)
    .order("version_number", { ascending: false });

  const loadedVersions = requireQuerySuccess(
    versionsError,
    versions ?? [],
    "Failed to load Gemba definition versions",
  );

  const draftVersion = loadedVersions.find((v) => v.status === "draft");
  const publishedVersion = loadedVersions.find((v) => v.status === "published");
  const editorVersion = draftVersion ?? publishedVersion;

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from("gemba_definition_applicable_units")
    .select("unit_id")
    .eq("definition_id", id);

  const applicableIds = requireGembaApplicableUnitIds(
    applicabilityError,
    applicabilityRows,
  );
  const mappedUnitIds = [...applicableIds];
  const { data: mappedUnits, error: mappedUnitsError } =
    mappedUnitIds.length > 0
      ? await supabase
          .from("organisation_units")
          .select("id, status")
          .in("id", mappedUnitIds)
      : { data: [], error: null };

  const unitStatusById = collectUnitStatuses(
    requireQuerySuccess(
      mappedUnitsError,
      mappedUnits ?? [],
      "Failed to load applicable organisational units",
    ),
  );
  const { units, context } = await loadActiveSiteContext();
  const configurationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const applicabilitySelection = splitApplicabilitySelection(
    applicableIds,
    configurationUnits.units,
    unitStatusById,
  );
  const executionUnits = buildApplicableSiteScopedUnitOptions(
    units,
    context,
    applicabilitySelection.confirmedActiveIds,
    { requireConcreteSite: true },
  );
  const applicabilityLabels = formatApplicableUnitLabels(
    applicabilitySelection.confirmedActiveIds,
    units,
  );
  const staleWarning = formatStaleApplicabilityWarning(
    applicabilitySelection.staleInactiveIds.length,
  );

  const authoring = await loadTemplateAuthoringChildren(
    supabase,
    editorVersion?.template_version_id,
  );
  const canPublishQuestions = isTemplateAuthoringPublishReady(authoring);
  const hasApplicableUnits = applicabilitySelection.confirmedActiveIds.size > 0;
  const canPublish = canPublishQuestions && hasApplicableUnits;

  const managementActions =
    (publishedVersion && !draftVersion && canManage) ||
    (canSchedule && publishedVersion) ? (
      <>
        {publishedVersion && !draftVersion && canManage ? (
          <form action={createGembaDefinitionSuccessorFromForm}>
            <input type="hidden" name="definitionId" value={id} />
            <Button type="submit" variant="outline" className="min-h-11">
              Create new version
            </Button>
          </form>
        ) : null}
        {canSchedule && publishedVersion ? (
          <Button variant="outline" className="min-h-11" asChild>
            <Link
              href={`/platform/schedule/new?activityId=${id}&activityLabel=${encodeURIComponent(definition.display_name)}&returnTo=/platform/gemba/definitions/${id}`}
              data-testid="create-schedule-link"
            >
              Create schedule
            </Link>
          </Button>
        ) : null}
      </>
    ) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <PublishedExecutionHeader
        title={definition.display_name}
        description={definition.description ?? "Gemba definition"}
        managementTestId="gemba-management-actions"
        executionTestId="gemba-execution-actions"
        {...(managementActions ? { managementActions } : {})}
        {...(publishedVersion
          ? {
              executionActions: (
                <ExecutionUnitStartForm
                  action={startGembaWalkFromForm}
                  hiddenFields={
                    <input type="hidden" name="definitionId" value={id} />
                  }
                  units={executionUnits.units}
                  requiresSiteSelection={executionUnits.requiresSiteSelection}
                  unitFieldId="gemba-unit-id"
                  label="Start walk for unit"
                  lockedLabel="Walk area"
                  submitLabel="Start walk"
                  emptyMessage="Select an active site in the sidebar before starting a walk."
                  notApplicableMessage="This definition is not applicable to the active site."
                  formTestId="gemba-start-walk-form"
                  unitSelectTestId="gemba-unit-select"
                  submitTestId="gemba-start-walk"
                />
              ),
            }
          : {})}
      />

      <div className="flex flex-wrap gap-2">
        {loadedVersions.map((version) => (
          <Badge key={version.id} variant="outline">
            v{version.version_number} ·{" "}
            {formatGembaVersionStatus(version.status)}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applicability</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p data-testid="gemba-applicable-areas">
            {applicabilityLabels.length > 0 ? (
              <>
                <span className="text-sm text-muted-foreground">
                  Applicable to:{" "}
                </span>
                <span className="font-medium">
                  {applicabilityLabels.join(", ")}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                No applicable areas configured. Start walk and scheduling stay
                blocked until at least one organisational unit is assigned.
              </span>
            )}
          </p>
          {canManage ? (
            <form
              action={setGembaDefinitionApplicableUnitsFromForm}
              className="flex max-w-lg flex-col gap-4"
            >
              <input type="hidden" name="definitionId" value={id} />
              <ApplicableUnitsField
                options={configurationUnits.units}
                selectedIds={applicabilitySelection.selectedIds}
                preservedIds={applicabilitySelection.preservedIds}
                staleWarning={staleWarning}
                staleWarningTestId="gemba-stale-applicability-warning"
                requiresSiteSelection={configurationUnits.requiresSiteSelection}
                description={APPLICABILITY_DESCRIPTION}
              />
              <Button
                type="submit"
                variant="outline"
                className="min-h-11"
                disabled={
                  configurationUnits.units.length === 0 &&
                  applicabilitySelection.preservedIds.length === 0
                }
                data-testid="save-gemba-applicability"
              >
                Save applicable areas
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {draftVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft v{draftVersion.version_number}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form
              action={addGembaSectionFromForm}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="definitionId" value={id} />
              <div>
                <Label htmlFor="sectionTitle">Section title</Label>
                <Input
                  id="sectionTitle"
                  name="sectionTitle"
                  required
                  className="mt-2 min-h-11"
                  data-testid="gemba-section-title"
                />
              </div>
              <Button type="submit" className="min-h-11">
                Add section
              </Button>
            </form>

            {authoring.sections.map((section) => (
              <div
                key={section.id}
                className="rounded-lg border border-border p-4"
                data-testid="authoring-section"
              >
                <p className="font-medium">{section.title}</p>
                {section.questions.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {section.questions.map((question) => (
                      <li
                        key={question.id}
                        className="rounded-md border border-border bg-surface px-3 py-2"
                        data-testid="authoring-question"
                      >
                        <p className="font-medium">{question.prompt}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No walk prompts in this section yet.
                  </p>
                )}
                <form
                  action={addGembaQuestionFromForm}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <input
                    type="hidden"
                    name="versionId"
                    value={draftVersion.id}
                  />
                  <input type="hidden" name="sectionId" value={section.id} />
                  <input type="hidden" name="definitionId" value={id} />
                  <div>
                    <Label htmlFor={`prompt-${section.id}`}>Walk prompt</Label>
                    <Input
                      id={`prompt-${section.id}`}
                      name="prompt"
                      required
                      className="mt-2 min-h-11"
                      data-testid="gemba-question-prompt"
                    />
                  </div>
                  <Button type="submit" className="min-h-11">
                    Add prompt
                  </Button>
                </form>
              </div>
            ))}

            <form action={publishGembaDefinitionFromForm}>
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="definitionId" value={id} />
              {!canPublishQuestions ? (
                <p
                  className="mb-3 text-sm text-muted-foreground"
                  data-testid="publish-blocked-reason"
                >
                  Add at least one walk prompt before publishing this
                  definition.
                </p>
              ) : null}
              {canPublishQuestions && !hasApplicableUnits ? (
                <p
                  className="mb-3 text-sm text-muted-foreground"
                  data-testid="publish-blocked-reason"
                >
                  Assign at least one applicable area before publishing this
                  definition.
                </p>
              ) : null}
              <Button
                type="submit"
                className="min-h-11"
                disabled={!canPublish}
                data-testid="publish-gemba-definition"
              >
                Publish definition
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : publishedVersion ? (
        <Card>
          <CardContent className="py-6">
            <Link href="/platform/gemba/history" className="text-sm underline">
              View walk history
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
