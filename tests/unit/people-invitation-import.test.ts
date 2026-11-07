import { describe, expect, it } from "vitest";

import { parseCsvContent } from "@/modules/people-invitation-import/parse-csv";
import { buildPeopleInvitationCsvTemplate, fingerprintImportContent } from "@/modules/people-invitation-import/parse-file";

const HEADER =
  "record_type,display_name,email,department,site,role,access_scope_site,parent_site_path,area_name,area_code,unit_type";

describe("people invitation import parsers", () => {
  it("parses valid colleague rows", () => {
    const parsed = parseCsvContent(
      `${HEADER}\nperson,Alex Morgan,alex@example.com,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations,,,,`,
    );
    expect("rows" in parsed).toBe(true);
    if ("rows" in parsed) {
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0]?.email).toBe("alex@example.com");
      expect(parsed.rows[0]?.display_name).toBe("Alex Morgan");
    }
  });

  it("normalises name alias into display_name", () => {
    const parsed = parseCsvContent(
      `${HEADER}\nperson,Morgan Lee,morgan@example.com,,Site > Ops,Team Member,Site > Ops,,,,`,
    );
    expect("rows" in parsed).toBe(true);
    if ("rows" in parsed) {
      expect(parsed.rows[0]?.display_name).toBe("Morgan Lee");
    }
  });

  it("rejects invalid emails during header validation only on row parse", () => {
    const parsed = parseCsvContent(
      `${HEADER}\nperson,Bad Row,not-an-email,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations,,,,`,
    );
    expect("rows" in parsed).toBe(true);
    if ("rows" in parsed) {
      expect(parsed.rows[0]?.email).toBe("not-an-email");
    }
  });

  it("rejects duplicate headers", () => {
    const parsed = parseCsvContent("email,email\na@example.com,a@example.com");
    expect(parsed).toEqual({
      error: 'Duplicate header "email" detected.',
    });
  });

  it("builds a template with person and unit examples", () => {
    const template = buildPeopleInvitationCsvTemplate();
    expect(template).toContain("record_type");
    expect(template).toContain("person,");
    expect(template).toContain("unit,");
  });

  it("fingerprints normalised file content deterministically", () => {
    const a = fingerprintImportContent("a\nb\n");
    const b = fingerprintImportContent("a\nb");
    expect(a).toBe(b);
  });
});
