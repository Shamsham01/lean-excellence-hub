import { describe, expect, it } from "vitest";

import {
  HYPOTHESIS_CATEGORIES,
  normalizeFishboneCategory,
} from "@/lib/problem-solving/hypothesis";

describe("normalizeFishboneCategory", () => {
  it("maps canonical 6M keys", () => {
    for (const category of HYPOTHESIS_CATEGORIES) {
      expect(normalizeFishboneCategory(category)).toBe(category);
    }
  });

  it("maps title case and demo seed labels", () => {
    expect(normalizeFishboneCategory("Machine")).toBe("machine");
    expect(normalizeFishboneCategory("Material")).toBe("material");
    expect(normalizeFishboneCategory("Method")).toBe("method");
    expect(normalizeFishboneCategory("Measurement")).toBe("measurement");
  });

  it("maps common Lean AI aliases", () => {
    expect(normalizeFishboneCategory("People")).toBe("man");
    expect(normalizeFishboneCategory("Man")).toBe("man");
    expect(normalizeFishboneCategory("Mother Nature")).toBe("environment");
    expect(normalizeFishboneCategory("mother_nature")).toBe("environment");
    expect(normalizeFishboneCategory("Environment")).toBe("environment");
  });

  it("falls back to other for unknown labels", () => {
    expect(normalizeFishboneCategory("")).toBe("other");
    expect(normalizeFishboneCategory("   ")).toBe("other");
    expect(normalizeFishboneCategory("Vendor")).toBe("other");
  });
});
