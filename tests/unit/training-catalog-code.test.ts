import { describe, expect, it } from "vitest";

import {
  generateTrainingCourseCode,
  resolveTrainingCourseCreateCode,
  resolveUniqueTrainingCourseCode,
} from "@/modules/training/catalog-code";

describe("generateTrainingCourseCode", () => {
  it("normalises course names to catalogue codes", () => {
    expect(generateTrainingCourseCode("Lean Basics 101")).toBe(
      "lean-basics-101",
    );
  });
});

describe("resolveUniqueTrainingCourseCode", () => {
  it("adds a suffix when the base code already exists", () => {
    expect(
      resolveUniqueTrainingCourseCode("lean-basics", ["lean-basics"]),
    ).toBe("lean-basics-2");
  });
});

describe("resolveTrainingCourseCreateCode", () => {
  it("rejects duplicate custom codes", () => {
    const result = resolveTrainingCourseCreateCode({
      name: "Lean basics",
      customCode: "lean-basics",
      existingCodes: ["lean-basics"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("already exists");
    }
  });

  it("generates a unique code from the name when no override is provided", () => {
    const result = resolveTrainingCourseCreateCode({
      name: "Lean basics",
      existingCodes: ["lean-basics"],
    });

    expect(result).toEqual({ ok: true, code: "lean-basics-2" });
  });
});
