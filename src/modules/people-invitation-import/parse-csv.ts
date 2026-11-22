import {
  mapRowValues,
  validateHeaders,
  type FileParseError,
  type ParsedPeopleInvitationImportFile,
} from "./headers";
import { PEOPLE_INVITATION_IMPORT_MAX_ROWS } from "./constants";

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseCsvContent(
  content: string,
): ParsedPeopleInvitationImportFile | FileParseError {
  const normalized = content.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(
      (line, index, allLines) => line.length > 0 || index < allLines.length - 1,
    );

  if (lines.length === 0) {
    return { error: "The file is empty." };
  }

  const headers = parseCsvLine(lines[0] ?? "");
  const headerError = validateHeaders(headers);
  if (headerError) {
    return headerError;
  }

  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.trim().length === 0) {
      continue;
    }
    rows.push(mapRowValues(headers, parseCsvLine(line)));
  }

  if (rows.length === 0) {
    return { error: "The file contains no data rows." };
  }

  if (rows.length > PEOPLE_INVITATION_IMPORT_MAX_ROWS) {
    return {
      error: `The file contains ${rows.length} rows. The maximum is ${PEOPLE_INVITATION_IMPORT_MAX_ROWS}.`,
    };
  }

  return { headers, rows };
}
