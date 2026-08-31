import { describe, expect, it } from "vitest";

import {
  buildCredentialExportCsv,
  sanitizeCsvCell,
} from "@/modules/workforce-import/credential-export";
import {
  mapWorkforceImportProgressFromDatabase,
  WORKFORCE_IMPORT_BATCH_SIZE,
} from "@/modules/workforce-import/constants";
import { parseCsvContent } from "@/modules/workforce-import/parse-csv";
import { buildCsvTemplate } from "@/modules/workforce-import/parse-file";
import { parseXlsxBuffer } from "@/modules/workforce-import/parse-xlsx";
import * as XLSX from "xlsx";

const HEADER =
  "first_name,last_name,username,notification_email,job_title,job_function,primary_unit_path,application_role,access_scope_unit_path";

describe("workforce import parsers", () => {
  it("parses valid CSV rows", () => {
    const parsed = parseCsvContent(
      `${HEADER}\nAnna,Smith,anna.smith,anna@example.com,Operator,Operator,Site > Ops,Team Member,Site > Ops`,
    );
    expect("rows" in parsed).toBe(true);
    if ("rows" in parsed) {
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0]?.username).toBe("anna.smith");
    }
  });

  it("rejects duplicate headers", () => {
    const parsed = parseCsvContent("first_name,first_name\nAnna,Smith");
    expect(parsed).toEqual({
      error: 'Duplicate header "first_name" detected.',
    });
  });

  it("rejects unsupported columns", () => {
    const parsed = parseCsvContent(
      "first_name,last_name,username,notification_email,job_title,job_function,primary_unit_path,application_role,access_scope_unit_path,employee_id\nAnna,Smith,anna.smith,,,,,,,123",
    );
    expect(parsed).toEqual({
      error: "Unsupported columns: employee_id.",
    });
  });

  it("parses xlsx files", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      HEADER.split(","),
      [
        "Anna",
        "Smith",
        "anna.smith",
        "",
        "Operator",
        "Operator",
        "Site > Ops",
        "Team Member",
        "Site > Ops",
      ],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Employees");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

    const parsed = parseXlsxBuffer(buffer);
    expect("rows" in parsed).toBe(true);
    if ("rows" in parsed) {
      expect(parsed.rows[0]?.first_name).toBe("Anna");
    }
  });
});

describe("credential export", () => {
  it("sanitises spreadsheet formula injection", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
  });

  it("builds credential export csv", () => {
    const csv = buildCredentialExportCsv({
      organisationCode: "apex-manufacturing",
      rows: [
        {
          firstName: "Anna",
          lastName: "Smith",
          username: "anna.smith",
          temporaryPassword: "TempPass123!",
        },
      ],
    });
    expect(csv).toContain("anna.smith,apex-manufacturing,TempPass123!");
  });
});

describe("template", () => {
  it("includes canonical headers", () => {
    expect(buildCsvTemplate()).toContain("primary_unit_path");
  });

  it("includes unit-scoped and organisation-scoped examples", () => {
    const template = buildCsvTemplate();
    expect(template).toContain("Team Member,Cornwall Plant > Operations");
    expect(template).toContain("Finance Validator,");
  });
});

describe("import progress mapping", () => {
  it("maps database progress payloads to camelCase", () => {
    expect(
      mapWorkforceImportProgressFromDatabase({
        status: "provisioning",
        total_rows: 3,
        valid_rows: 3,
        error_rows: 0,
        warning_rows: 0,
        provisioned_rows: 1,
        failed_rows: 0,
        remediation_rows: 0,
        remaining_rows: 2,
        credential_export_status: "none",
        credential_expires_at: null,
        completed_at: null,
      }),
    ).toEqual({
      status: "provisioning",
      totalRows: 3,
      validRows: 3,
      errorRows: 0,
      warningRows: 0,
      provisionedRows: 1,
      failedRows: 0,
      remediationRows: 0,
      remainingRows: 2,
      credentialExportStatus: "none",
      credentialExpiresAt: null,
      completedAt: null,
    });
  });

  it("uses a single-row batch size", () => {
    expect(WORKFORCE_IMPORT_BATCH_SIZE).toBe(1);
  });
});
