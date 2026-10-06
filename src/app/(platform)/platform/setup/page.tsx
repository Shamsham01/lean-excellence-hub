import { SetupChecklist } from "@/components/onboarding/setup-checklist";
import { CoreSetupBanner } from "@/components/onboarding/core-setup-banner";
import { FirstCustomerSetupIntro } from "@/components/onboarding/first-customer-setup-intro";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadOrganisationSetupSnapshot } from "@/modules/organisation-setup/queries";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export default async function SetupPage() {
  const [snapshot, canReadHierarchy] = await Promise.all([
    loadOrganisationSetupSnapshot(),
    currentMemberHasPermission("hierarchy.read"),
  ]);

  return (
    <div className="flex flex-col gap-8" data-testid="setup-page">
      <PageHeader
        title="Get the first site ready"
        description={`What ${snapshot.organisationName} needs before this site can run.`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink href="/platform" data-testid="setup-return-link">
              Return to workspace
            </AppLink>
          </Button>
        }
      />

      <FirstCustomerSetupIntro
        organisationName={snapshot.organisationName}
        firstSiteName={snapshot.firstSiteName}
        multiSiteIntent={snapshot.multiSiteIntent}
        canOpenRollout={canReadHierarchy}
      />

      <CoreSetupBanner
        core={snapshot.core}
        nextActionHref={snapshot.nextActionHref}
        nextActionLabel={snapshot.nextActionLabel}
      />

      <SetupChecklist
        title="Before this site can run"
        description="Authoritative setup status. Visiting a page does not mark a step complete."
        items={snapshot.core.items}
      />

      <SetupChecklist
        title="Choose what to configure next"
        description="Recommended, not mandatory. Use the modules that form your operating system."
        items={snapshot.recommended.items}
      />
    </div>
  );
}
