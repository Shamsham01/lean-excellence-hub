"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type {
  WorkforceImportProgress,
  WorkforceImportValidationSummary,
} from "@/modules/workforce-import/constants";
import {
  buildCsvTemplate,
  parseWorkforceImportFile,
} from "@/modules/workforce-import/parse-file";
import { WORKFORCE_IMPORT_BATCH_SIZE } from "@/modules/workforce-import/constants";

type ImportPreviewRow = {
  row_number: number;
  display_name: string | null;
  username: string | null;
  job_function: string | null;
  primary_unit_path: string | null;
  application_role: string | null;
  access_scope_unit_path: string | null;
};

type ValidationRow = {
  rowNumber: number;
  employeeLabel: string;
  status: string;
  fieldErrors: Array<{
    field: string;
    issue: string;
    suggestion: string;
  }>;
};

type WorkforceImportWizardProps = {
  organisationCode: string;
  onCreateJob: (
    filename: string,
  ) => Promise<{ ok: true; data: { jobId: string } } | { error: string }>;
  onSubmitRows: (
    jobId: string,
    rows: import("@/modules/workforce-import/constants").WorkforceImportRowInput[],
  ) => Promise<{ ok: true; data: { jobId: string } } | { error: string }>;
  onValidate: (
    jobId: string,
  ) => Promise<
    { ok: true; data: WorkforceImportValidationSummary } | { error: string }
  >;
  onLoadValidationRows: (
    jobId: string,
  ) => Promise<{ ok: true; data: ValidationRow[] } | { error: string }>;
  onLoadPreviewRows: (
    jobId: string,
  ) => Promise<{ ok: true; data: ImportPreviewRow[] } | { error: string }>;
  onStartProvisioning: (
    jobId: string,
  ) => Promise<{ ok: true; data: { jobId: string } } | { error: string }>;
  onRunBatch: (jobId: string) => Promise<
    | {
        ok: true;
        data: {
          claimed: number;
          succeeded: number;
          failed: number;
          remediation: number;
          progress: WorkforceImportProgress;
        };
      }
    | { error: string }
  >;
  onGetProgress: (
    jobId: string,
  ) => Promise<{ ok: true; data: WorkforceImportProgress } | { error: string }>;
  onExportCredentials: (
    jobId: string,
    organisationCode: string,
  ) => Promise<{ ok: true; data: { csv: string } } | { error: string }>;
  onExportErrorReport: (
    jobId: string,
  ) => Promise<{ ok: true; data: { csv: string } } | { error: string }>;
  onRetryFailedRows: (
    jobId: string,
  ) => Promise<{ ok: true; data: { resetCount: number } } | { error: string }>;
};

const STEPS = [
  "Upload file",
  "Validate & map",
  "Review",
  "Provision",
  "Download credentials",
] as const;

export function WorkforceImportWizard({
  organisationCode,
  onCreateJob,
  onSubmitRows,
  onValidate,
  onLoadValidationRows,
  onLoadPreviewRows,
  onStartProvisioning,
  onRunBatch,
  onGetProgress,
  onExportCredentials,
  onExportErrorReport,
  onRetryFailedRows,
}: WorkforceImportWizardProps) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [rowCount, setRowCount] = useState(0);
  const [summary, setSummary] =
    useState<WorkforceImportValidationSummary | null>(null);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [progress, setProgress] = useState<WorkforceImportProgress | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [credentialsExported, setCredentialsExported] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const progressPercent = useMemo(() => {
    if (!progress || progress.totalRows === 0) {
      return 0;
    }
    return Math.round((progress.provisionedRows / progress.totalRows) * 100);
  }, [progress]);

  async function handleFileSelected(file: File | null) {
    setMessage(null);
    if (!file) {
      return;
    }

    setLoading(true);
    const parsed = await parseWorkforceImportFile(file);
    if ("error" in parsed) {
      setMessage(parsed.error);
      setLoading(false);
      return;
    }

    const created = await onCreateJob(file.name);
    if ("error" in created) {
      setMessage(created.error);
      setLoading(false);
      return;
    }

    const submitted = await onSubmitRows(created.data.jobId, parsed.rows);
    if ("error" in submitted) {
      setMessage(submitted.error);
      setLoading(false);
      return;
    }

    setJobId(created.data.jobId);
    setFilename(file.name);
    setRowCount(parsed.rows.length);
    setStep(1);
    setLoading(false);
  }

  async function handleValidate() {
    if (!jobId) return;
    setLoading(true);
    setMessage(null);

    const validated = await onValidate(jobId);
    if ("error" in validated) {
      setMessage(validated.error);
      setLoading(false);
      return;
    }

    const rows = await onLoadValidationRows(jobId);
    if ("error" in rows) {
      setMessage(rows.error);
      setLoading(false);
      return;
    }

    setSummary(validated.data);
    setValidationRows(rows.data);
    setLoading(false);

    if (validated.data.canProvision) {
      const preview = await onLoadPreviewRows(jobId);
      if ("ok" in preview) {
        setPreviewRows(preview.data);
      }
      setStep(2);
    }
  }

  async function handleStartProvisioning() {
    if (!jobId) return;
    setLoading(true);
    setMessage(null);

    const started = await onStartProvisioning(jobId);
    if ("error" in started) {
      setMessage(started.error);
      setLoading(false);
      return;
    }

    setStep(3);
    setProvisioning(true);
    setLoading(false);
  }

  useEffect(() => {
    if (!provisioning || !jobId) {
      return;
    }

    let cancelled = false;

    async function runBatches() {
      while (!cancelled) {
        const batch = await onRunBatch(jobId!);
        if ("error" in batch) {
          setMessage(batch.error);
          setProvisioning(false);
          return;
        }

        setProgress(batch.data.progress);

        if (batch.data.progress.remainingRows === 0) {
          setProvisioning(false);
          setStep(4);
          return;
        }

        if (batch.data.claimed === 0) {
          const refreshed = await onGetProgress(jobId!);
          if ("ok" in refreshed) {
            setProgress(refreshed.data);
            if (refreshed.data.remainingRows === 0) {
              setProvisioning(false);
              setStep(4);
              return;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    void runBatches();

    return () => {
      cancelled = true;
    };
  }, [provisioning, jobId, onRunBatch, onGetProgress]);

  async function handleDownloadCredentials() {
    if (!jobId) return;
    setLoading(true);
    setMessage(null);

    const exported = await onExportCredentials(jobId, organisationCode);
    if ("error" in exported) {
      setMessage(exported.error);
      setLoading(false);
      return;
    }

    const blob = new Blob([exported.data.csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workforce-credentials-${jobId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setCredentialsExported(true);
    setLoading(false);
  }

  async function handleDownloadErrorReport() {
    if (!jobId) return;
    const exported = await onExportErrorReport(jobId);
    if ("error" in exported) {
      setMessage(exported.error);
      return;
    }

    const blob = new Blob([exported.data.csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workforce-import-errors-${jobId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const blob = new Blob([buildCsvTemplate()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workforce-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="workforce-import-wizard">
      <div className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={
              index === step
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {message ? (
        <p className="text-sm text-destructive" data-testid="import-message">
          {message}
        </p>
      ) : null}

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload workforce file</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or XLSX file with up to 1,000 employees. Validation
              runs on the complete file before any accounts are created.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={downloadTemplate}
              >
                Download CSV template
              </Button>
            </div>
            <Input
              type="file"
              accept=".csv,.xlsx"
              data-testid="workforce-import-file"
              onChange={(event) => {
                void handleFileSelected(event.target.files?.[0] ?? null);
              }}
              disabled={loading}
            />
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validate and map</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {filename}: {rowCount.toLocaleString()} rows detected.
            </p>
            <Button
              data-testid="validate-import"
              onClick={() => void handleValidate()}
              disabled={loading}
            >
              {loading ? "Validating..." : "Validate entire file"}
            </Button>
            {summary ? (
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p>Valid: {summary.validRows}</p>
                <p>Errors: {summary.errorRows}</p>
                <p>Warnings: {summary.warningRows}</p>
              </div>
            ) : null}
            {validationRows.length > 0 ? (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => void handleDownloadErrorReport()}
                >
                  Download error report
                </Button>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Field</th>
                        <th className="p-2">Issue</th>
                        <th className="p-2">Suggested resolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationRows.flatMap((row) =>
                        row.fieldErrors.map((fieldError, index) => (
                          <tr key={`${row.rowNumber}-${index}`}>
                            <td className="p-2">{row.rowNumber}</td>
                            <td className="p-2">{row.employeeLabel}</td>
                            <td className="p-2">{fieldError.field}</td>
                            <td className="p-2">{fieldError.issue}</td>
                            <td className="p-2">{fieldError.suggestion}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review resolved preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Confirm the resolved mappings before provisioning begins.
            </p>
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {previewRows.slice(0, 20).map((row) => (
                <div
                  key={row.row_number}
                  className="rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">{row.display_name}</p>
                  <p>Username: {row.username}</p>
                  <p>Job function: {row.job_function}</p>
                  <p>Primary work area: {row.primary_unit_path}</p>
                  <p>Application role: {row.application_role}</p>
                  <p>Access scope: {row.access_scope_unit_path}</p>
                </div>
              ))}
              {previewRows.length > 20 ? (
                <p className="text-sm text-muted-foreground">
                  Showing first 20 of {previewRows.length} employees.
                </p>
              ) : null}
            </div>
            <Button
              data-testid="start-import-provisioning"
              onClick={() => void handleStartProvisioning()}
              disabled={loading || !summary?.canProvision}
            >
              Provision {summary?.validRows ?? 0} employees
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provisioning workforce</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Progress value={progressPercent} />
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>Successful: {progress?.provisionedRows ?? 0}</p>
              <p>Failed: {progress?.failedRows ?? 0}</p>
              <p>Remaining: {progress?.remainingRows ?? 0}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Processing in batches of {WORKFORCE_IMPORT_BATCH_SIZE} to avoid
              platform timeouts.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download credentials</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-amber-700">
              Temporary passwords are available once. Store and distribute this
              file securely. Employees must change their password at first
              sign-in.
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>Provisioned: {progress?.provisionedRows ?? 0}</p>
              <p>Failed: {progress?.failedRows ?? 0}</p>
              <p>Remediation: {progress?.remediationRows ?? 0}</p>
            </div>
            {progress && progress.failedRows > 0 ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (!jobId) return;
                  void onRetryFailedRows(jobId).then((result) => {
                    if ("error" in result) {
                      setMessage(result.error);
                      return;
                    }
                    if (result.data.resetCount > 0) {
                      setProvisioning(true);
                      setStep(3);
                    }
                  });
                }}
              >
                Retry failed rows
              </Button>
            ) : null}
            <Button
              data-testid="download-import-credentials"
              onClick={() => void handleDownloadCredentials()}
              disabled={
                loading ||
                credentialsExported ||
                progress?.credentialExportStatus === "exported"
              }
            >
              {credentialsExported
                ? "Credentials exported"
                : "Download credentials"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
