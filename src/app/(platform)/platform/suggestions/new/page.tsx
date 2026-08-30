import { PageHeader } from "@/components/platform/page-header";
import { NewSuggestionForm } from "@/components/suggestions/new-suggestion-form";
import { Card, CardContent } from "@/components/ui/card";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { SUGGESTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { notFound } from "next/navigation";

type SubmissionConfiguration = {
  programmes: Array<{
    programme_version_id: string;
    programme_name: string;
    submission_guidance: string | null;
  }>;
  categories: Array<{
    category_id: string;
    category_name: string;
  }>;
};

export default async function NewSuggestionPage() {
  const canSubmit = await currentMemberHasPermission(
    SUGGESTIONS_PERMISSIONS.submit,
  );
  if (!canSubmit) notFound();

  const supabase = await createServerSupabaseClient();
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (o) => o.selected,
  )?.membership_id;

  const { data: configurationData, error: configurationError } =
    await supabase.rpc("get_available_suggestion_submission_configuration");

  let loadError: string | null = null;
  let programmesForForm: Array<{ id: string; programme_name: string }> = [];
  let categoriesForForm: Array<{ id: string; name: string }> = [];

  if (configurationError) {
    loadError = "Unable to load suggestion configuration.";
  } else {
    const configuration = configurationData as SubmissionConfiguration | null;
    programmesForForm =
      configuration?.programmes?.map((programme) => ({
        id: programme.programme_version_id,
        programme_name: programme.programme_name,
      })) ?? [];
    categoriesForForm =
      configuration?.categories?.map((category) => ({
        id: category.category_id,
        name: category.category_name,
      })) ?? [];
  }

  const [
    { data: primaryUnitData },
    canManageJobFunctions,
    canManageProgrammes,
  ] = await Promise.all([
    supabase.rpc("get_current_membership_primary_unit"),
    currentMembershipId
      ? currentMemberHasPermission("job_functions.manage")
      : Promise.resolve(false),
    currentMemberHasPermission(SUGGESTIONS_PERMISSIONS.programmesManage),
  ]);

  const primaryUnit = primaryUnitData as {
    has_primary_unit?: boolean;
    unit_name?: string;
  } | null;

  return (
    <div
      className="mx-auto flex max-w-xl flex-col gap-6"
      data-testid="new-suggestion-page"
    >
      <PageHeader
        title="New suggestion"
        description="Share what you've noticed and what you'd change — takes about a minute."
      />

      {loadError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : null}

      <NewSuggestionForm
        programmeVersions={programmesForForm}
        categories={categoriesForForm}
        canManageProgrammes={canManageProgrammes}
        primaryUnit={{
          hasPrimaryUnit: primaryUnit?.has_primary_unit === true,
          canManageAssignment: canManageJobFunctions,
          ...(currentMembershipId ? { membershipId: currentMembershipId } : {}),
          ...(primaryUnit?.unit_name
            ? { unitName: primaryUnit.unit_name }
            : {}),
        }}
      />
    </div>
  );
}
