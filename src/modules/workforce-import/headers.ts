import {
  WORKFORCE_IMPORT_CANONICAL_COLUMNS,
  type WorkforceImportCanonicalColumn,
  type WorkforceImportRowInput,
} from "./constants";

export type ParsedWorkforceImportFile = {
  headers: string[];
  rows: WorkforceImportRowInput[];
};

export type FileParseError = {
  error: string;
};

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

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

  const missing = WORKFORCE_IMPORT_CANONICAL_COLUMNS.filter(
    (column) => !normalized.includes(column),
  );

  if (missing.length > 0) {
    return {
      error: `Missing required columns: ${missing.join(", ")}.`,
    };
  }

  const unsupported = normalized.filter(
    (header) =>
      !WORKFORCE_IMPORT_CANONICAL_COLUMNS.includes(
        header as WorkforceImportCanonicalColumn,
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
): WorkforceImportRowInput {
  const normalizedHeaders = headers.map(normalizeHeader);
  const row: Partial<WorkforceImportRowInput> = {};

  for (const column of WORKFORCE_IMPORT_CANONICAL_COLUMNS) {
    row[column] = "";
  }

  normalizedHeaders.forEach((header, index) => {
    if (
      WORKFORCE_IMPORT_CANONICAL_COLUMNS.includes(
        header as WorkforceImportCanonicalColumn,
      )
    ) {
      row[header as WorkforceImportCanonicalColumn] = (
        values[index] ?? ""
      ).trim();
    }
  });

  return row as WorkforceImportRowInput;
}

export function employeeLabelFromRow(row: WorkforceImportRowInput): string {
  const first = row.first_name.trim();
  const last = row.last_name.trim();
  if (first || last) {
    return `${first} ${last}`.trim();
  }
  return row.username.trim() || "Unknown employee";
}
