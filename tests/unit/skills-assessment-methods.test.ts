import { describe, expect, it } from "vitest";

import {
  formatSkillAssessmentMethodLabel,
  isSkillValidationMethod,
  SKILL_VALIDATION_METHOD_LABELS,
  SKILL_VALIDATION_METHODS,
} from "@/modules/skills/assessment-methods";

describe("SKILL_VALIDATION_METHODS", () => {
  it("lists exactly the five database check constraint keys", () => {
    expect(SKILL_VALIDATION_METHODS).toEqual([
      "manager_assessment",
      "practical_observation",
      "qualification",
      "trainer_sign_off",
      "external_certification",
    ]);
  });

  it("does not include legacy dialog tokens or self_assessment", () => {
    for (const invalid of [
      "observation",
      "portfolio_review",
      "certification",
      "practical_test",
      "self_assessment",
    ]) {
      expect(SKILL_VALIDATION_METHODS).not.toContain(invalid);
    }
  });

  it("exposes human labels for every canonical method", () => {
    for (const method of SKILL_VALIDATION_METHODS) {
      expect(SKILL_VALIDATION_METHOD_LABELS[method]).toMatch(/\S/);
      expect(SKILL_VALIDATION_METHOD_LABELS[method]).not.toBe(method);
    }
  });

  it("isSkillValidationMethod accepts canonical keys only", () => {
    expect(isSkillValidationMethod("practical_observation")).toBe(true);
    expect(isSkillValidationMethod("")).toBe(false);
    expect(isSkillValidationMethod(undefined)).toBe(false);
    expect(isSkillValidationMethod("observation")).toBe(false);
  });

  it("formatSkillAssessmentMethodLabel maps validation and self paths", () => {
    expect(formatSkillAssessmentMethodLabel("practical_observation")).toBe(
      "Practical observation",
    );
    expect(formatSkillAssessmentMethodLabel("self_assessment")).toBe(
      "Self assessment",
    );
    expect(formatSkillAssessmentMethodLabel(null)).toBeNull();
  });
});
