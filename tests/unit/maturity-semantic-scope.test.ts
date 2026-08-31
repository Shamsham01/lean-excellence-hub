import { describe, expect, it } from "vitest";

import {
  MATURITY_ASSESSMENT_SCOPE_TYPES,
  defaultAssessmentScopes,
  normaliseUnitTypeToSemanticScope,
  scopeTypeLabel,
} from "@/modules/maturity/semantic-scope";

describe("maturity semantic scope", () => {
  it("maps common Lean unit types to semantic scopes", () => {
    expect(normaliseUnitTypeToSemanticScope("plant")).toBe("site");
    expect(normaliseUnitTypeToSemanticScope("SITE")).toBe("site");
    expect(normaliseUnitTypeToSemanticScope("department")).toBe("department");
    expect(normaliseUnitTypeToSemanticScope("area")).toBe("area");
    expect(normaliseUnitTypeToSemanticScope("organisation")).toBe(
      "organisation",
    );
  });

  it("does not map line or team scopes", () => {
    expect(normaliseUnitTypeToSemanticScope("line")).toBeNull();
    expect(normaliseUnitTypeToSemanticScope("team")).toBeNull();
    expect(normaliseUnitTypeToSemanticScope("finance")).toBeNull();
  });

  it("defaults new frameworks to site-only assessment scope", () => {
    expect(defaultAssessmentScopes()).toEqual(["site"]);
  });

  it("labels scope types for UI copy", () => {
    for (const scope of MATURITY_ASSESSMENT_SCOPE_TYPES) {
      expect(scopeTypeLabel(scope)).toBeTruthy();
    }
  });
});
