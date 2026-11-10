import { PageHeader } from "@/components/platform/page-header";
import { NewSuggestionForm } from "@/components/suggestions/new-suggestion-form";
import { Card, CardContent } from "@/components/ui/card";
import { loadNewSuggestionFormConfiguration } from "@/lib/suggestions/load-new-suggestion-configuration";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { SUGGESTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { notFound } from "next/navigation";

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

  const configuration = await loadNewSuggestionFormConfiguration(
    supabase,
    currentMembershipId,
  );

  return (
    <div
      className="mx-auto flex max-w-xl flex-col gap-6"
      data-testid="new-suggestion-page"
    >
      <PageHeader
        title="New suggestion"
        description="Share what you've noticed and what you'd change — takes about a minute."
      />

      {configuration.loadError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {configuration.loadError}
          </CardContent>
        </Card>
      ) : null}

      <NewSuggestionForm
        programmeVersions={configuration.programmesForForm}
        categories={configuration.categoriesForForm}
        canManageProgrammes={configuration.canManageProgrammes}
        primaryUnit={configuration.primaryUnit}
      />
    </div>
  );
}
