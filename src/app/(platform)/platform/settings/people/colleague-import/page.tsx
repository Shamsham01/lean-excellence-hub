import { redirect } from "next/navigation";

import { PeopleInvitationImportWizard } from "@/components/people/people-invitation-import-wizard";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

import {
  buildColleagueImportErrorReport,
  createColleagueImportJob,
  getColleagueImportPreviewRows,
  getColleagueImportValidationRows,
  runColleagueImportBatch,
  startColleagueImport,
  submitColleagueImportRows,
  validateColleagueImportJob,
} from "./actions";

export default async function ColleagueImportPage() {
  const [canInvite, canDelegate] = await Promise.all([
    currentMemberHasPermission("invitations.manage"),
    currentMemberHasPermission("roles.delegate"),
  ]);

  if (!canInvite || !canDelegate) {
    redirect("/platform/settings/people");
  }

  return (
    <div
      className="flex w-full max-w-full min-w-0 flex-col gap-8"
      data-testid="colleague-import-page"
    >
      <PageHeader
        title="Import colleagues"
        description="Bulk invite people with validated roles, sites, and optional work-area setup. Invitations use the same secure links as single invites."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/people"
                data-testid="colleague-import-directory-link"
              >
                People directory
              </AppLink>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/settings/people"
                data-testid="colleague-import-settings-link"
              >
                People settings
              </AppLink>
            </Button>
          </div>
        }
      />

      <PeopleInvitationImportWizard
        onCreateJob={createColleagueImportJob}
        onSubmitRows={submitColleagueImportRows}
        onValidate={validateColleagueImportJob}
        onLoadValidationRows={getColleagueImportValidationRows}
        onLoadPreviewRows={getColleagueImportPreviewRows}
        onStartImport={startColleagueImport}
        onRunBatch={runColleagueImportBatch}
        onExportErrorReport={buildColleagueImportErrorReport}
      />
    </div>
  );
}
