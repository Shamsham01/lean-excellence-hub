import { describe, expect, it } from "vitest";

import {
  COMMON_UNIT_TYPES,
  formatUnitTypeLabel,
  isCommonUnitType,
  resolveUnitTypeChoice,
} from "@/modules/organisation/unit-types";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";

describe("organisation unit types", () => {
  it("offers common descriptive types without Site", () => {
    expect(COMMON_UNIT_TYPES.map((option) => option.value)).toEqual([
      "department",
      "area",
      "team",
      "line",
      "function",
    ]);
    expect(
      COMMON_UNIT_TYPES.some((option) => isSiteUnitType(option.value)),
    ).toBe(false);
  });

  it("keeps custom terminology editable", () => {
    expect(isCommonUnitType("ward")).toBe(false);
    expect(resolveUnitTypeChoice("ward")).toBe("custom");
    expect(formatUnitTypeLabel("ward")).toBe("Ward");
    expect(formatUnitTypeLabel("department")).toBe("Department");
  });
});
