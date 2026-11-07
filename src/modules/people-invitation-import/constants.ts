export const PEOPLE_INVITATION_IMPORT_MAX_ROWS = 1000;

export const PEOPLE_INVITATION_IMPORT_BATCH_SIZE = 25;

export const PEOPLE_INVITATION_IMPORT_PERSON_COLUMNS = [
  "record_type",
  "display_name",
  "email",
  "department",
  "site",
  "role",
  "access_scope_site",
] as const;

export const PEOPLE_INVITATION_IMPORT_UNIT_COLUMNS = [
  "record_type",
  "parent_site_path",
  "area_name",
  "area_code",
  "unit_type",
] as const;

/** Accepted CSV headers (includes aliases). */
export const PEOPLE_INVITATION_IMPORT_ACCEPTED_HEADERS = [
  "record_type",
  "display_name",
  "name",
  "email",
  "department",
  "job_function",
  "site",
  "primary_unit_path",
  "role",
  "application_role",
  "access_scope_site",
  "access_scope_unit_path",
  "parent_site_path",
  "parent_site",
  "area_name",
  "unit_name",
  "area_code",
  "unit_code",
  "unit_type",
] as const;

export type PeopleInvitationImportRowInput = Record<string, string>;

export type PeopleInvitationImportFieldError = {
  field: string;
  issue: string;
  suggestion: string;
};

export type PeopleInvitationImportValidationSummary = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  canImport: boolean;
};

export type PeopleInvitationImportProgress = {
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  createdInvitationRows: number;
  createdUnitRows: number;
  skippedRows: number;
  failedRows: number;
  remainingRows: number;
  completedAt: string | null;
};

export function mapPeopleInvitationImportProgressFromDatabase(
  progress: Record<string, unknown>,
): PeopleInvitationImportProgress {
  return {
    status: String(progress.status ?? ""),
    totalRows: Number(progress.total_rows ?? 0),
    validRows: Number(progress.valid_rows ?? 0),
    errorRows: Number(progress.error_rows ?? 0),
    warningRows: Number(progress.warning_rows ?? 0),
    createdInvitationRows: Number(progress.created_invitation_rows ?? 0),
    createdUnitRows: Number(progress.created_unit_rows ?? 0),
    skippedRows: Number(progress.skipped_rows ?? 0),
    failedRows: Number(progress.failed_rows ?? 0),
    remainingRows: Number(progress.remaining_rows ?? 0),
    completedAt:
      typeof progress.completed_at === "string" ? progress.completed_at : null,
  };
}
