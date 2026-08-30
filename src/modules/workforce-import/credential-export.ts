import type { WorkforceImportFieldError } from "./constants";
import { employeeLabelFromRow } from "./headers";
import type { WorkforceImportRowInput } from "./constants";

export function sanitizeCsvCell(value: string): string {
  const trimmed = value.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function buildCredentialExportCsv(input: {
  organisationCode: string;
  rows: Array<{
    firstName: string;
    lastName: string;
    username: string;
    temporaryPassword: string;
    jobTitle?: string | null;
    primaryUnitPath?: string | null;
  }>;
  includeOptionalColumns?: boolean;
}): string {
  const includeOptional = input.includeOptionalColumns ?? true;
  const headers = [
    "first_name",
    "last_name",
    "username",
    "organisation_code",
    "temporary_password",
    ...(includeOptional ? ["job_title", "primary_work_area"] : []),
  ];

  const lines = [headers.join(",")];

  for (const row of input.rows) {
    const values = [
      sanitizeCsvCell(row.firstName),
      sanitizeCsvCell(row.lastName),
      sanitizeCsvCell(row.username),
      sanitizeCsvCell(input.organisationCode),
      sanitizeCsvCell(row.temporaryPassword),
    ];

    if (includeOptional) {
      values.push(
        sanitizeCsvCell(row.jobTitle ?? ""),
        sanitizeCsvCell(row.primaryUnitPath ?? ""),
      );
    }

    lines.push(values.map(escapeCsvValue).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildValidationErrorReportCsv(
  rows: Array<{
    rowNumber: number;
    employeeLabel: string;
    fieldErrors: WorkforceImportFieldError[];
  }>,
): string {
  const headers = ["row_number", "employee", "field", "issue", "suggested_resolution"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    for (const fieldError of row.fieldErrors) {
      lines.push(
        [
          String(row.rowNumber),
          escapeCsvValue(row.employeeLabel),
          escapeCsvValue(fieldError.field),
          escapeCsvValue(fieldError.issue),
          escapeCsvValue(fieldError.suggestion),
        ].join(","),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export function mapValidationRowsFromDatabase(
  rows: Array<{
    row_number: number;
    status: string;
    input_payload: WorkforceImportRowInput | Record<string, string>;
    field_errors: WorkforceImportFieldError[] | null;
  }>,
) {
  return rows
    .filter((row) => row.status === "error" || row.status === "warning")
    .map((row) => ({
      rowNumber: row.row_number,
      employeeLabel: employeeLabelFromRow(row.input_payload as WorkforceImportRowInput),
      status: row.status,
      fieldErrors: row.field_errors ?? [],
    }));
}
