import { describe, expect, it } from "vitest";

import { buildStructureFirstGuidance } from "@/modules/organisation-onboarding/guidance";
import {
  cloneManufacturingStructureDraft,
  countDraftUnits,
  flattenDraftUnits,
  unusedJobFunctionSuggestions,
} from "@/modules/organisation-onboarding/templates";

describe("structure-first onboarding guidance", () => {
  it("offers advisory Quality guidance without claiming a correct structure", () => {
    const guidance = buildStructureFirstGuidance({
      unitNames: ["Production", "Engineering"],
      jobFunctionNames: ["Team Leader"],
      childUnitCount: 2,
      activeJobFunctionCount: 1,
      activeMembershipCount: 1,
      pendingInvitationCount: 0,
    });

    expect(guidance.map((item) => item.id)).toEqual([
      "quality-unit-optional",
      "operator-function-optional",
      "people-optional",
    ]);
    expect(guidance[0]?.body).toMatch(/Add one only if that reflects/);
    expect(
      guidance.some((item) => /determined the correct/i.test(item.body)),
    ).toBe(false);
  });

  it("keeps manufacturing suggestions frontend-only until confirmation", () => {
    const draft = cloneManufacturingStructureDraft();
    expect(countDraftUnits(draft)).toBeGreaterThan(6);
    expect(flattenDraftUnits(draft).every((unit) => unit.name.length > 0)).toBe(
      true,
    );
    expect(
      flattenDraftUnits(draft).some((unit) => unit.unitType === "site"),
    ).toBe(false);
  });

  it("hides job function suggestions that already exist", () => {
    const remaining = unusedJobFunctionSuggestions(["operator", "team-leader"]);
    expect(remaining.some((item) => item.code === "operator")).toBe(false);
    expect(remaining.some((item) => item.name === "CI Manager")).toBe(true);
  });
});
