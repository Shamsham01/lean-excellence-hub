import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { WorkforceImportHistory } from "@/components/people/workforce-import-history";
import { WorkforceImportWizard } from "@/components/people/workforce-import-wizard";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  buildImportErrorReport,
  createImportJob,
  exportImportCredentials,
  getImportJobSnapshot,
  getImportPreviewRows,
  getImportProgress,
  getImportValidationRows,
  listRecentImportJobs,
  retryFailedImportRows,
  runImportBatch,
  startImportProvisioning,
  submitImportRows,
  validateImportJob,
} from "../actions";

type WorkforceImportJobPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function WorkforceImportJobPage({
  params,
}: WorkforceImportJobPageProps) {
  const canImport = await currentMemberHasPermission("workforce.import");
  if (!canImport) {
    redirect("/platform/settings/people");
  }

  const { jobId } = await params;
  const supabase = await createServerSupabaseClient();
  const [snapshotResult, organisationResult, historyResult] = await Promise.all(
    [
      getImportJobSnapshot(jobId),
      supabase.from("organisations").select("code").single(),
      listRecentImportJobs(),
    ],
  );

  if (!snapshotResult || "error" in snapshotResult) {
    notFound();
  }

  const organisationCode = organisationResult.data?.code ?? "";
  const history =
    historyResult && "ok" in historyResult && historyResult.ok
      ? historyResult.data
      : [];

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="workforce-import-job-page"
    >
      <PageHeader
        title="Import workforce"
        description="Resume or review a bulk workforce import. Progress is stored securely and can be continued after refresh or sign-out."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/settings/people/import">New import</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/settings/people">Back to people</Link>
            </Button>
          </div>
        }
      />

      <WorkforceImportWizard
        organisationCode={organisationCode}
        initialJobId={snapshotResult.data.jobId}
        onCreateJob={createImportJob}
        onSubmitRows={submitImportRows}
        onValidate={validateImportJob}
        onLoadValidationRows={getImportValidationRows}
        onLoadPreviewRows={getImportPreviewRows}
        onStartProvisioning={startImportProvisioning}
        onRunBatch={runImportBatch}
        onGetProgress={getImportProgress}
        onGetJobSnapshot={getImportJobSnapshot}
        onExportCredentials={exportImportCredentials}
        onExportErrorReport={buildImportErrorReport}
        onRetryFailedRows={retryFailedImportRows}
      />

      <WorkforceImportHistory jobs={history} />
    </div>
  );
}
