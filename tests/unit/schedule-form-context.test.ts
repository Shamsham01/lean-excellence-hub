import { describe, expect, it } from "vitest";

import { interpretFiveSStandardLookup } from "@/modules/operational/five-s-applicability";
import { interpretGembaDefinitionLookup } from "@/modules/operational/gemba-applicability";

describe("schedule edit load-path hardening notes", () => {
  it("keeps 5S/Gemba lookup helpers throwing for their own pages", () => {
    expect(() =>
      interpretFiveSStandardLookup({ message: "RLS denied" }, null),
    ).toThrow(/Failed to load 5S standard/);
    expect(() =>
      interpretGembaDefinitionLookup({ message: "RLS denied" }, null),
    ).toThrow(/Failed to load Gemba definition/);
  });
});
