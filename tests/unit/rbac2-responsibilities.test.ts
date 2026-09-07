import { describe, expect, it } from "vitest";

import {
  moduleResponsibilityLabels,
  responsibilityDisplayName,
  responsibilityScopeLabel,
} from "@/modules/rbac2/responsibilities";

describe("rbac2 responsibilities", () => {
  it("maps module responsibility keys to product labels", () => {
    expect(moduleResponsibilityLabels.suggestions).toBe("Suggestions");
    expect(moduleResponsibilityLabels.five_s).toBe("5S");
  });

  it("prefers module responsibility label over role display name", () => {
    expect(
      responsibilityDisplayName({
        role_display_name: "Suggestions Manager",
        module_responsibility_key: "suggestions",
      }),
    ).toBe("Suggestions");
  });

  it("formats subtree scope labels", () => {
    expect(
      responsibilityScopeLabel({
        scope_type: "unit_subtree",
        scope_unit_name: "Production",
      }),
    ).toBe("Production subtree");
  });

  it("formats organisation scope labels", () => {
    expect(
      responsibilityScopeLabel({
        scope_type: "organisation",
        scope_unit_name: null,
      }),
    ).toBe("Entire organisation");
  });
});
