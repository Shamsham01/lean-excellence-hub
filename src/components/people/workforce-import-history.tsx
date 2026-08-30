import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveImportJobHistoryAction } from "@/modules/workforce-import/resume";

export type WorkforceImportHistoryJob = {
  id: string;
  original_filename: string;
  total_rows: number;
  status: string;
  provisioned_rows: number;
  failed_rows: number;
  remediation_rows: number;
  credential_export_status: string;
  created_at: string;
};

type WorkforceImportHistoryProps = {
  jobs: WorkforceImportHistoryJob[];
};

function formatJobStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export function WorkforceImportHistory({ jobs }: WorkforceImportHistoryProps) {
  return (
    <Card data-testid="workforce-import-history">
      <CardHeader>
        <CardTitle className="text-base">Recent workforce imports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {jobs.length === 0 ? (
          <p className="text-muted-foreground">No imports yet.</p>
        ) : (
          jobs.map((job) => {
            const action = resolveImportJobHistoryAction({
              id: job.id,
              status: job.status,
              credential_export_status: job.credential_export_status,
              remediation_rows: job.remediation_rows,
              failed_rows: job.failed_rows,
            });

            return (
              <div
                key={job.id}
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`import-job-row-${job.id}`}
              >
                <div>
                  <p className="font-medium">{job.original_filename}</p>
                  <p className="text-muted-foreground">
                    {new Date(job.created_at).toLocaleString("en-GB")} ·{" "}
                    {job.total_rows} employees
                  </p>
                  <p className="text-muted-foreground capitalize">
                    {formatJobStatus(job.status)}
                    {job.status === "provisioning" ||
                    job.status === "completed" ||
                    job.status === "completed_with_remediation"
                      ? ` · ${job.provisioned_rows}/${job.total_rows} provisioned`
                      : null}
                    {job.failed_rows > 0
                      ? ` · ${job.failed_rows} failed`
                      : null}
                    {job.remediation_rows > 0
                      ? ` · ${job.remediation_rows} remediation`
                      : null}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={action.href} data-testid={action.testId}>
                    {action.label}
                  </Link>
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
