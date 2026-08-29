import { describe, expect, it } from "vitest";

import { formatAccessScopeDisplay } from "@/lib/access-scope";

describe("formatAccessScopeDisplay", () => {
  it("formats organisation scope", () => {
    expect(formatAccessScopeDisplay({ scope_type: "organisation" })).toBe(
      "Entire organisation",
    );
  });

  it("formats unit subtree scope with unit name", () => {
    expect(
      formatAccessScopeDisplay({
        scope_type: "unit_subtree",
        scope_unit_name: "Production",
      }),
    ).toBe("Production and its sub-areas");
  });

  it("falls back to unit name for other scoped grants", () => {
    expect(
      formatAccessScopeDisplay({
        scope_type: "unit",
        scope_unit_name: "Line 3",
      }),
    ).toBe("Line 3");
  });
});
