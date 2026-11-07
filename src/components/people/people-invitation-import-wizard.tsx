"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type {
  PeopleInvitationImportProgress,
  PeopleInvitationImportValidationSummary,
} from "@/modules/people-invitation-import/constants";
import {
  buildPeopleInvitationCsvTemplate,
  fingerprintImportContent,
  parsePeopleInvitationImportFile,
} from "@/modules/people-invitation-import/parse-file";
import type { PeopleInvitationImportRowInput } from "@/modules/people-invitation-import/constants";

type ValidationRow = {
  rowNumber: number;
  recordType: string;
  label: string;
  status: string;
  fieldErrors: Array<{
    field: string;
    issue: string;
    suggestion: string;
  }>;
};

type PeopleInvitationImportWizardProps = {
  onCreateJob: (
    filename: string,
    contentFingerprint: string,
  ) => Promise<{ ok: true; data: { jobId: string } } | { error: string }>;
  onSubmitRows: (
    jobId: string,
    rows: PeopleInvitationImportRowInput[],
  ) => Promise<{ ok: true; data: { jobId: string } } | { error: string }>;
  onValidate: (
    jobId: string,
  ) => Promise<
    { ok: true; data: PeopleInvitationImportValidationSummary } | { error: string }
  >;
  onLoadValidationRows: (
    jobId: string,
  ) => Promise<{ ok: true; data: ValidationRow[] } | { error: string }>;
  onLoadPreviewRows: (
    jobId: string,
  ) => Promise<
    | {
        ok: true;
        data: Array<{
          row_number: number;
          display_name: string | null;
          email: string | null;
          department: string | null;
          site: string | null;
          application_role: string | null;
        }>;
      }
    | { error: string }
  >;
  onStartImport: (
    jobId: string,
  ) => Promise<{ ok: true; data: { jobId: string } } | { error: string }>;
  onRunBatch: (jobId: string) => Promise<
    | {
        ok: true;
        data: {
          claimed: number;
          progress: PeopleInvitationImportProgress;
        };
      }
    | { error: string }
  >;
  onExportErrorReport: (
    jobId: string,
  ) => Promise<{ ok: true; data: { csv: string } } | { error: string }>;
};

const STEPS = ["Upload", "Validate", "Review", "Import", "Summary"] as const;

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PeopleInvitationImportWizard({
  onCreateJob,
  onSubmitRows,
  onValidate,
  onLoadValidationRows,
  onLoadPreviewRows,
  onStartImport,
  onRunBatch,
  onExportErrorReport,
}: PeopleInvitationImportWizardProps) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [summary, setSummary] =
    useState<PeopleInvitationImportValidationSummary | null>(null);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [previewRows, setPreviewRows] = useState<
    Array<{
      row_number: number;
      display_name: string | null;
      email: string | null;
      department: string | null;
      site: string | null;
      application_role: string | null;
    }>
  >([]);
  const [progress, setProgress] = useState<PeopleInvitationImportProgress | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const progressPercent = useMemo(() => {
    if (!progress || progress.totalRows === 0) return 0;
    const done =
      progress.createdInvitationRows +
      progress.createdUnitRows +
      progress.skippedRows +
      progress.failedRows;
    return Math.round((done / progress.totalRows) * 100);
  }, [progress]);

  async function handleFileSelected(file: File | null) {
    setMessage(null);
    if (!file) return;

    setLoading(true);
    const content = await file.text();
    const parsed = await parsePeopleInvitationImportFile(file);
    if ("error" in parsed) {
      setMessage(parsed.error);
      setLoading(false);
      return;
    }

    const fingerprint = fingerprintImportContent(content);
    const created = await onCreateJob(file.name, fingerprint);
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

    if (validated.data.canImport) {
      const preview = await onLoadPreviewRows(jobId);
      if ("ok" in preview) {
        setPreviewRows(preview.data);
      }
      setStep(2);
    } else {
      setStep(1);
    }

    setLoading(false);
  }

  async function handleConfirmImport() {
    if (!jobId) return;
    setImporting(true);
    setMessage(null);
    setStep(3);

    const started = await onStartImport(jobId);
    if ("error" in started) {
      setMessage(started.error);
      setImporting(false);
      return;
    }

    while (true) {
      const batch = await onRunBatch(jobId);
      if ("error" in batch) {
        setMessage(batch.error);
        setImporting(false);
        return;
      }
      setProgress(batch.data.progress);
      if (batch.data.progress.remainingRows === 0) {
        break;
      }
      if (
        batch.data.claimed === 0 &&
        batch.data.progress.status.startsWith("completed")
      ) {
        break;
      }
    }

    setImporting(false);
    setStep(4);
  }

  async function handleDownloadTemplate() {
    downloadTextFile(
      "colleague-import-template.csv",
      buildPeopleInvitationCsvTemplate(),
      "text/csv",
    );
  }

  async function handleDownloadErrorReport() {
    if (!jobId) return;
    const report = await onExportErrorReport(jobId);
    if ("error" in report) {
      setMessage(report.error);
      return;
    }
    downloadTextFile(
      "colleague-import-errors.csv",
      report.data.csv,
      "text/csv",
    );
  }

  return (
    <Card data-testid="people-invitation-import-wizard">
      <CardHeader className="gap-2">
        <CardTitle className="text-base">Bulk colleague import</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a CSV to invite colleagues using your existing invitation
          pipeline. Set{" "}
          <span className="font-mono text-xs">record_type=unit</span> on optional
          rows to create work areas before inviting people.
        </p>
        <div
          className="flex flex-wrap gap-2 text-xs text-muted-foreground"
          aria-label="Import steps"
        >
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={
                index === step
                  ? "rounded-md bg-accent/10 px-2 py-1 font-medium text-accent"
                  : "px-2 py-1"
              }
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {message ? (
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : null}

        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={handleDownloadTemplate}
              data-testid="download-colleague-import-template"
            >
              Download CSV template
            </Button>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="colleague-import-file">
                Upload filled CSV
              </label>
              <Input
                id="colleague-import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={loading}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleFileSelected(file);
                }}
                data-testid="colleague-import-file-input"
              />
            </div>
          </div>
        ) : null}

        {step === 1 && jobId ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              File <span className="font-medium text-foreground">{filename}</span>{" "}
              is ready for validation.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleValidate}
                disabled={loading}
                data-testid="validate-colleague-import"
              >
                Validate rows
              </Button>
              {summary && summary.errorRows > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadErrorReport}
                  data-testid="download-colleague-import-errors"
                >
                  Download error report
                </Button>
              ) : null}
            </div>
            {validationRows.length > 0 ? (
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Label</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t align-top">
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.rowNumber}
                        </td>
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 capitalize">{row.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.fieldErrors.map((error) => (
                            <p key={`${row.rowNumber}-${error.field}`}>
                              {error.issue}
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 && summary ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              {summary.validRows} of {summary.totalRows} rows are ready.
              {summary.warningRows > 0
                ? ` ${summary.warningRows} rows will be skipped or merged.`
                : null}
            </p>
            {previewRows.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-md border text-sm">
                <ul className="divide-y">
                  {previewRows.map((row) => (
                    <li key={row.row_number} className="px-3 py-2">
                      <span className="font-medium">{row.display_name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {row.email} · {row.application_role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              type="button"
              onClick={handleConfirmImport}
              data-testid="confirm-colleague-import"
            >
              Confirm and send invitations
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Import in progress…</p>
            <Progress value={progressPercent} data-testid="colleague-import-progress" />
          </div>
        ) : null}

        {step === 4 && progress ? (
          <div
            className="flex flex-col gap-3 text-sm"
            data-testid="colleague-import-summary"
          >
            <p className="font-medium">Import complete</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>Invitations created: {progress.createdInvitationRows}</li>
              <li>Units created: {progress.createdUnitRows}</li>
              <li>Skipped: {progress.skippedRows}</li>
              <li>Failed: {progress.failedRows}</li>
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setStep(0);
                setJobId(null);
                setSummary(null);
                setValidationRows([]);
                setPreviewRows([]);
                setProgress(null);
              }}
            >
              Import another file
            </Button>
          </div>
        ) : null}

        {importing ? (
          <p className="sr-only" aria-live="polite">
            Import running
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
