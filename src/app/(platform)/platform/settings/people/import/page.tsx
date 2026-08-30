import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkforceImportWizard } from "@/components/people/workforce-import-wizard";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  buildImportErrorReport,
  createImportJob,
  exportImportCredentials,
  getImportPreviewRows,
  getImportProgress,
  getImportValidationRows,
  listRecentImportJobs,
  retryFailedImportRows,
  runImportBatch,
  startImportProvisioning,
  submitImportRows,
  validateImportJob,
} from "./actions";

export default async function WorkforceImportPage() {
  const canImport = await currentMemberHasPermission("workforce.import");
  if (!canImport) {
    redirect("/platform/settings/people");
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: organisation }, historyResult] = await Promise.all([
    supabase.from("organisations").select("code").single(),
    listRecentImportJobs(),
  ]);

  const organisationCode = organisation?.code ?? "";
  const history =
    historyResult && "ok" in historyResult && historyResult.ok
      ? historyResult.data
      : [];

  return (
    <div className="flex flex-col gap-8" data-testid="workforce-import-page">
      <PageHeader
        title="Import workforce"
        description="Bulk onboard employees from CSV or XLSX with validated mappings and one-time credential export."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/settings/people/create">Add employee</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/settings/people">Back to people</Link>
            </Button>
          </div>
        }
      />

      <WorkforceImportWizard
        organisationCode={organisationCode}
        onCreateJob={createImportJob}
        onSubmitRows={submitImportRows}
        onValidate={validateImportJob}
        onLoadValidationRows={getImportValidationRows}
        onLoadPreviewRows={getImportPreviewRows}
        onStartProvisioning={startImportProvisioning}
        onRunBatch={runImportBatch}
        onGetProgress={getImportProgress}
        onExportCredentials={exportImportCredentials}
        onExportErrorReport={buildImportErrorReport}
        onRetryFailedRows={retryFailedImportRows}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent workforce imports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {history.length === 0 ? (
            <p className="text-muted-foreground">No imports yet.</p>
          ) : (
            history.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{job.original_filename}</p>
                  <p className="text-muted-foreground">
                    {new Date(job.created_at).toLocaleString("en-GB")} ·{" "}
                    {job.total_rows} employees
                  </p>
                </div>
                <p className="capitalize text-muted-foreground">
                  {job.status.replaceAll("_", " ")}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
