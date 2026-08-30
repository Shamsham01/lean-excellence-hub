export const WORKFORCE_IMPORT_MAX_ROWS = 1000;

export const WORKFORCE_IMPORT_BATCH_SIZE = 25;

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
