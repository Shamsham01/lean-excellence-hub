import {
  PEOPLE_INVITATION_IMPORT_ACCEPTED_HEADERS,
  type PeopleInvitationImportRowInput,
} from "./constants";

export type ParsedPeopleInvitationImportFile = {
  headers: string[];
  rows: PeopleInvitationImportRowInput[];
};

export type FileParseError = {
  error: string;
};

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

const REQUIRED_PERSON_HEADERS = ["email", "role"] as const;

export function validateHeaders(headers: string[]): FileParseError | null {
  if (headers.length === 0) {
    return { error: "The file has no header row." };
  }

  const normalized = headers.map(normalizeHeader);
  const seen = new Set<string>();

  for (const header of normalized) {
    if (seen.has(header)) {
      return { error: `Duplicate header "${header}" detected.` };
    }
    seen.add(header);
  }

  const hasName = normalized.includes("display_name") || normalized.includes("name");
  if (!hasName) {
    return {
      error: "Missing required column: display_name (or name).",
    };
  }

  for (const required of REQUIRED_PERSON_HEADERS) {
    const aliases =
      required === "role"
        ? ["role", "application_role"]
        : required === "email"
          ? ["email"]
          : [required];
    if (!aliases.some((column) => normalized.includes(column))) {
      return {
        error: `Missing required column: ${required}.`,
      };
    }
  }

  const unsupported = normalized.filter(
    (header) =>
      !PEOPLE_INVITATION_IMPORT_ACCEPTED_HEADERS.includes(
        header as (typeof PEOPLE_INVITATION_IMPORT_ACCEPTED_HEADERS)[number],
      ),
  );

  if (unsupported.length > 0) {
    return {
      error: `Unsupported columns: ${unsupported.join(", ")}.`,
    };
  }

  return null;
}

export function mapRowValues(
  headers: string[],
  values: string[],
): PeopleInvitationImportRowInput {
  const normalizedHeaders = headers.map(normalizeHeader);
  const row: PeopleInvitationImportRowInput = {};

  normalizedHeaders.forEach((header, index) => {
    row[header] = (values[index] ?? "").trim();
  });

  const recordType = (row.record_type ?? "person").toLowerCase();
  row.record_type = recordType === "unit" ? "unit" : "person";

  if (row.name && !row.display_name) {
    row.display_name = row.name;
  }

  if (row.job_function && !row.department) {
    row.department = row.job_function;
  }

  if (row.primary_unit_path && !row.site) {
    row.site = row.primary_unit_path;
  }

  if (row.application_role && !row.role) {
    row.role = row.application_role;
  }

  if (row.access_scope_unit_path && !row.access_scope_site) {
    row.access_scope_site = row.access_scope_unit_path;
  }

  if (row.unit_name && !row.area_name) {
    row.area_name = row.unit_name;
  }

  if (row.unit_code && !row.area_code) {
    row.area_code = row.unit_code;
  }

  if (row.parent_site && !row.parent_site_path) {
    row.parent_site_path = row.parent_site;
  }

  return row;
}

export function rowLabelFromInput(row: PeopleInvitationImportRowInput): string {
  if (row.record_type === "unit") {
    return row.area_name || row.unit_name || "Unit row";
  }
  return row.display_name || row.name || row.email || "Colleague row";
}
