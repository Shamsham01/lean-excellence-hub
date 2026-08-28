import { describe, expect, it } from "vitest";

import {
  normaliseOrganisationUnitCode,
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
});
