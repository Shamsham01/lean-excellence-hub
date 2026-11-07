import { createHash } from "node:crypto";

import { parseCsvContent } from "./parse-csv";
import type { FileParseError, ParsedPeopleInvitationImportFile } from "./headers";

export async function parsePeopleInvitationImportFile(
  file: File,
): Promise<ParsedPeopleInvitationImportFile | FileParseError> {
  const lowerName = file.name.toLowerCase();

  if (!lowerName.endsWith(".csv")) {
    return {
      error: "Unsupported file type. Upload a .csv file.",
    };
  }

  const content = await file.text();
  return parseCsvContent(content);
}

export function buildPeopleInvitationCsvTemplate(): string {
  return [
    "record_type,display_name,email,department,site,role,access_scope_site,parent_site_path,area_name,area_code,unit_type",
    "person,Alex Morgan,alex.morgan@example.com,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations,,,,",
    "person,Jordan Lee,jordan.lee@example.com,Engineer,Cornwall Plant > Engineering,Team Member,Cornwall Plant > Engineering,,,,",
    "unit,,,,,,,Cornwall Plant > Operations,Packaging Line,PKG-01,area",
  ].join("\n");
}

export function fingerprintImportContent(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex");
}
