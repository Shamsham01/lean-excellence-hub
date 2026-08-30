import { parseCsvContent } from "./parse-csv";
import { parseXlsxBuffer } from "./parse-xlsx";
import type { FileParseError, ParsedWorkforceImportFile } from "./headers";

export async function parseWorkforceImportFile(
  file: File,
): Promise<ParsedWorkforceImportFile | FileParseError> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    const content = await file.text();
    return parseCsvContent(content);
  }

  if (lowerName.endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer);
  }

  return {
    error: "Unsupported file type. Upload a .csv or .xlsx file.",
  };
}

export function buildCsvTemplate(): string {
  return [
    "first_name,last_name,username,notification_email,job_title,job_function,primary_unit_path,application_role,access_scope_unit_path",
    "Anna,Smith,anna.smith,anna@example.com,Production Operator,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations",
    "John,Brown,john.brown,,Engineer,Engineer,Cornwall Plant > Engineering,Team Member,Cornwall Plant > Engineering",
  ].join("\n");
}
