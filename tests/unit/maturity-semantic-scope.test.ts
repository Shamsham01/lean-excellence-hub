import { describe, expect, it } from "vitest";

import {
  MATURITY_ASSESSMENT_SCOPE_TYPES,
  MATURITY_FRAMEWORK_SCOPE_TYPES,
  defaultAssessmentScopes,
  isHistoricalAssessmentScopeType,
  normaliseUnitTypeToSemanticScope,
  scopeTypeLabel,
} from "@/modules/maturity/semantic-scope";

describe("maturity semantic scope", () => {
  it("maps common Lean unit types to selectable semantic scopes", () => {
    expect(normaliseUnitTypeToSemanticScope("plant")).toBe("site");
    expect(normaliseUnitTypeToSemanticScope("SITE")).toBe("site");
    expect(normaliseUnitTypeToSemanticScope("department")).toBe("department");
    expect(normaliseUnitTypeToSemanticScope("area")).toBe("area");
  });

  it("does not map line, team, finance, or organisation unit types", () => {
    expect(normaliseUnitTypeToSemanticScope("line")).toBeNull();
    expect(normaliseUnitTypeToSemanticScope("team")).toBeNull();
    expect(normaliseUnitTypeToSemanticScope("finance")).toBeNull();
    expect(normaliseUnitTypeToSemanticScope("organisation")).toBeNull();
  });

  it("defaults new frameworks to site-only assessment scope", () => {
    expect(defaultAssessmentScopes()).toEqual(["site"]);
  });

  it("excludes organisation from selectable framework scopes", () => {
    expect(MATURITY_FRAMEWORK_SCOPE_TYPES).toEqual(["site", "department", "area"]);
    expect(MATURITY_ASSESSMENT_SCOPE_TYPES).not.toContain("organisation");
  });

  it("labels scope types for UI copy", () => {
    for (const scope of MATURITY_ASSESSMENT_SCOPE_TYPES) {
      expect(scopeTypeLabel(scope)).toBeTruthy();
    }
    expect(scopeTypeLabel("legacy_unit")).toContain("historical");
    expect(isHistoricalAssessmentScopeType("legacy_unit")).toBe(true);
  });
});
