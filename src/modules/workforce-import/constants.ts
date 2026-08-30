export const WORKFORCE_IMPORT_MAX_ROWS = 1000;

/**
 * Each claimed row runs M1 Auth user creation plus workforce-provision and
 * workforce-import-finalize edge calls. A single-row batch keeps each Next.js
 * server-action request within Netlify/serverless wall-clock limits while the
 * database claim RPC preserves idempotent resume across interruptions.
 */
export const WORKFORCE_IMPORT_BATCH_SIZE = 1;

export const WORKFORCE_IMPORT_CANONICAL_COLUMNS = [
  "first_name",
  "last_name",
  "username",
  "notification_email",
  "job_title",
  "job_function",
  "primary_unit_path",
  "application_role",
  "access_scope_unit_path",
] as const;

export type WorkforceImportCanonicalColumn =
  (typeof WORKFORCE_IMPORT_CANONICAL_COLUMNS)[number];

export type WorkforceImportRowInput = Record<
  WorkforceImportCanonicalColumn,
  string
>;

export type WorkforceImportFieldError = {
  field: string;
  issue: string;
  suggestion: string;
};

export type WorkforceImportValidationRow = {
  rowNumber: number;
  employeeLabel: string;
  status: string;
  fieldErrors: WorkforceImportFieldError[];
};

export type WorkforceImportValidationSummary = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  canProvision: boolean;
};

export type WorkforceImportProgress = {
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  provisionedRows: number;
  failedRows: number;
  remediationRows: number;
  remainingRows: number;
  credentialExportStatus: string;
  credentialExpiresAt: string | null;
  completedAt: string | null;
};

export function mapWorkforceImportProgressFromDatabase(
  progress: Record<string, unknown>,
): WorkforceImportProgress {
  return {
    status: String(progress.status ?? ""),
    totalRows: Number(progress.total_rows ?? 0),
    validRows: Number(progress.valid_rows ?? 0),
    errorRows: Number(progress.error_rows ?? 0),
    warningRows: Number(progress.warning_rows ?? 0),
    provisionedRows: Number(progress.provisioned_rows ?? 0),
    failedRows: Number(progress.failed_rows ?? 0),
    remediationRows: Number(progress.remediation_rows ?? 0),
    remainingRows: Number(progress.remaining_rows ?? 0),
    credentialExportStatus: String(progress.credential_export_status ?? ""),
    credentialExpiresAt:
      typeof progress.credential_expires_at === "string"
        ? progress.credential_expires_at
        : null,
    completedAt:
      typeof progress.completed_at === "string" ? progress.completed_at : null,
  };
}
