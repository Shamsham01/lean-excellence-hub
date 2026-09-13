import { describe, expect, it } from "vitest";

import {
  interpretGembaDefinitionLookup,
  requireGembaApplicableUnitIds,
} from "@/modules/operational/gemba-applicability";

describe("Gemba applicability helpers", () => {
  it("treats a successful empty applicability query as empty, not all units", () => {
    expect(requireGembaApplicableUnitIds(null, [])).toEqual(new Set());
    expect(requireGembaApplicableUnitIds(undefined, null)).toEqual(new Set());
  });

  it("fails closed when applicability rows cannot be loaded", () => {
    expect(() =>
      requireGembaApplicableUnitIds({ message: "JWT expired" }, [
        { unit_id: "exeter-packing" },
      ]),
    ).toThrow("Failed to load Gemba applicability: JWT expired");
  });

  it("distinguishes a missing Gemba definition from a lookup failure", () => {
    expect(interpretGembaDefinitionLookup(null, null)).toBe("not_gemba");
    expect(interpretGembaDefinitionLookup(null, { id: "definition-1" })).toBe(
      "gemba",
    );
    expect(() =>
      interpretGembaDefinitionLookup({ message: "connection reset" }, null),
    ).toThrow("Failed to load Gemba definition: connection reset");
  });
});
