import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatAiSettingsSaveError,
  isValidMonthlyTokenCeiling,
  parseMonthlyTokenCeiling,
} from "@/lib/ai/organisation-ai-settings";

describe("organisation AI settings contract", () => {
  it("accepts a positive integer ceiling and rejects everything else", () => {
    expect(parseMonthlyTokenCeiling("")).toBeNull();
    expect(parseMonthlyTokenCeiling(" 1000 ")).toBe(1000);
    expect(parseMonthlyTokenCeiling("0")).toBe("invalid");
    expect(parseMonthlyTokenCeiling("12.5")).toBe("invalid");
    expect(parseMonthlyTokenCeiling("1e6")).toBe("invalid");
    expect(parseMonthlyTokenCeiling("500000")).toBe(500000);
    expect(isValidMonthlyTokenCeiling(2_147_483_647)).toBe(true);
    expect(isValidMonthlyTokenCeiling(2_147_483_648)).toBe(false);
  });

  it("hides database exceptions from the administrator", () => {
    expect(
      formatAiSettingsSaveError({
        message: "invalid monthly token ceiling",
      }),
    ).toMatch(/whole number/i);
    expect(
      formatAiSettingsSaveError({
        code: "42501",
        message:
          "permission denied for function update_organisation_ai_settings",
      }),
    ).toMatch(/not authorised/i);
    expect(
      formatAiSettingsSaveError({
        message: "organisation ai monthly token ceiling reached",
      }),
    ).toBe("LeanAI settings could not be saved. Please try again.");
  });

  it("does not encode catalogue allowances in start_ai_run", () => {
    const files = [
      "supabase/migrations/20260827009007_milestone12_ai_run_operations.sql",
      "supabase/migrations/20260930103004_leanai_general_coach_sessions.sql",
    ];

    for (const file of files) {
      const sql = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(sql).not.toMatch(/500_?000|2_?000_?000/);
      expect(sql).toMatch(/monthly_token_ceiling is not null/);
      expect(sql).toMatch(/organisation ai monthly token ceiling reached/);
    }
  });
});
