import { SetupChecklist } from "@/components/onboarding/setup-checklist";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadOrganisationSetupSnapshot } from "@/modules/organisation-setup/queries";

export default async function SetupPage() {
  const snapshot = await loadOrganisationSetupSnapshot();

  return (
    <div className="flex flex-col gap-8" data-testid="setup-page">
      <PageHeader
        title="Get the first site ready"
        description={snapshot.organisationName}
        descriptionTestId="setup-org-name"
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink href="/platform" data-testid="setup-return-link">
              Return to workspace
            </AppLink>
          </Button>
        }
      />

      <SetupChecklist title="Before this site can run" items={snapshot.core.items} />
    </div>
  );
}
