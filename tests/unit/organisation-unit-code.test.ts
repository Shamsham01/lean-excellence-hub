import { describe, expect, it } from "vitest";

import {
  normaliseOrganisationUnitCode,
  suggestOrganisationUnitCode,
  validateOrganisationUnitCode,
} from "@/modules/organisation-setup/unit-code";

describe("organisation unit code validation", () => {
  it("normalises to lowercase with hyphens", () => {
    expect(normaliseOrganisationUnitCode("DEMO SITE")).toBe("demo-site");
  });

  it("accepts valid codes", () => {
    const result = validateOrganisationUnitCode("ward-a");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalised).toBe("ward-a");
    }
  });

  it("rejects uppercase without normalisation path", () => {
    const result = validateOrganisationUnitCode("DEMO-SITE");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalised).toBe("demo-site");
    }
  });

  it("rejects invalid characters with friendly message", () => {
    const result = validateOrganisationUnitCode("!!!");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("lowercase");
    }
  });

  it("rejects empty codes", () => {
    const result = validateOrganisationUnitCode("   ");
    expect(result.ok).toBe(false);
  });

  it("slugifies unit names into valid codes", () => {
    expect(suggestOrganisationUnitCode("Community")).toBe("community");
    expect(suggestOrganisationUnitCode("Media & Marketing")).toBe(
      "media-marketing",
    );
    expect(suggestOrganisationUnitCode("Technical Operations")).toBe(
      "technical-operations",
    );
  });

  it("adds a deterministic suffix when the generated code is taken", () => {
    expect(suggestOrganisationUnitCode("Community", ["community"])).toBe(
      "community-2",
    );
    expect(
      suggestOrganisationUnitCode("Community", ["community", "community-2"]),
    ).toBe("community-3");
  });
});
