import * as XLSX from "xlsx";

import { WORKFORCE_IMPORT_MAX_ROWS } from "./constants";
import {
  mapRowValues,
  validateHeaders,
  type FileParseError,
  type ParsedWorkforceImportFile,
} from "./headers";

export function parseXlsxBuffer(
  buffer: ArrayBuffer,
): ParsedWorkforceImportFile | FileParseError {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    return { error: "Unable to read the XLSX file." };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { error: "The XLSX file has no worksheets." };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { error: "The XLSX worksheet is empty." };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    {
      header: 1,
      raw: false,
      defval: "",
    },
  );

  if (matrix.length === 0) {
    return { error: "The file is empty." };
  }

  const headers = (matrix[0] ?? []).map((value) => String(value ?? ""));
  const headerError = validateHeaders(headers);
  if (headerError) {
    return headerError;
  }

  const rows = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const values = (matrix[index] ?? []).map((value) =>
      String(value ?? "").trim(),
    );
    if (values.every((value) => value.length === 0)) {
      continue;
    }
    rows.push(
      mapRowValues(
        headers,
        values.map((value) => value),
      ),
    );
  }

  if (rows.length === 0) {
    return { error: "The file contains no employee rows." };
  }

  if (rows.length > WORKFORCE_IMPORT_MAX_ROWS) {
    return {
      error: `The file contains ${rows.length} rows. The maximum is ${WORKFORCE_IMPORT_MAX_ROWS}.`,
    };
  }

  return { headers, rows };
}
