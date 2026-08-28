import Link from "next/link";

import { SetupChecklist } from "@/components/onboarding/setup-checklist";
import { CoreSetupBanner } from "@/components/onboarding/core-setup-banner";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { loadOrganisationSetupSnapshot } from "@/modules/organisation-setup/queries";

export default async function SetupPage() {
  const snapshot = await loadOrganisationSetupSnapshot();

  return (
    <div className="flex flex-col gap-8" data-testid="setup-page">
      <PageHeader
        title="Organisation setup"
        description={`Configure ${snapshot.organisationName} for Lean Excellence Hub.`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform">Return to workspace</Link>
          </Button>
        }
      />

      <CoreSetupBanner
        core={snapshot.core}
        nextActionHref={snapshot.nextActionHref}
        nextActionLabel={snapshot.nextActionLabel}
      />

      <SetupChecklist
        title="Core setup"
        description="Complete these steps before your organisation is ready to start."
        items={snapshot.core.items}
      />

      <SetupChecklist
        title="Recommended next steps"
        description="Optional configuration to help your team get more value from Lean Excellence Hub."
        items={snapshot.recommended.items}
      />
    </div>
  );
}
