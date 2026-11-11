// VERIFY draft for PR #391 (Spec A): contract tests for
// src/modules/skills/assessment-methods.ts, including drift guards against the
// migration, the dialog source and LeanAI product knowledge.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SKILLS_KNOWLEDGE_ARTICLES } from "@/modules/leanai-context/product-knowledge/skills";
import {
  formatSkillAssessmentMethodLabel,
  isSkillValidationMethod,
  SKILL_VALIDATION_METHOD_LABELS,
  SKILL_VALIDATION_METHODS,
} from "@/modules/skills/assessment-methods";

const CANONICAL = [
  "manager_assessment",
  "practical_observation",
  "qualification",
  "trainer_sign_off",
  "external_certification",
] as const;

const SPEC_LABELS: Record<(typeof CANONICAL)[number], string> = {
  manager_assessment: "Manager assessment",
  practical_observation: "Practical observation",
  qualification: "Qualification",
  trainer_sign_off: "Trainer sign-off",
  external_certification: "External certification",
};

function latestValidationMigration(): string {
  const dir = "supabase/migrations";
  const file = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .reverse()
    .find((name) =>
      readFileSync(join(dir, name), "utf8").includes(
        "create or replace function private.record_skill_validation(",
      ),
    );
  if (!file) throw new Error("record_skill_validation migration not found");
  return readFileSync(join(dir, file), "utf8");
}

describe("SKILL_VALIDATION_METHODS (Spec A canonical enum)", () => {
  it("is exactly the five validation keys, in dialog order", () => {
    expect([...SKILL_VALIDATION_METHODS]).toEqual([...CANONICAL]);
  });

  it("has no duplicates", () => {
    expect(new Set(SKILL_VALIDATION_METHODS).size).toBe(
      SKILL_VALIDATION_METHODS.length,
    );
  });

  it("labels match the Spec A table exactly and cover every key", () => {
    expect(Object.keys(SKILL_VALIDATION_METHOD_LABELS).sort()).toEqual(
      [...CANONICAL].sort(),
    );
    for (const method of CANONICAL) {
      expect(SKILL_VALIDATION_METHOD_LABELS[method]).toBe(SPEC_LABELS[method]);
    }
  });

  it("labels are human text, never raw tokens", () => {
    for (const label of Object.values(SKILL_VALIDATION_METHOD_LABELS)) {
      expect(label).not.toMatch(/_/);
    }
  });
});

describe("formatSkillAssessmentMethodLabel", () => {
  it("maps validation and self paths to human labels", () => {
    expect(formatSkillAssessmentMethodLabel("practical_observation")).toBe(
      "Practical observation",
    );
    expect(formatSkillAssessmentMethodLabel("self_assessment")).toBe(
      "Self assessment",
    );
    expect(formatSkillAssessmentMethodLabel(null)).toBeNull();
  });
});

describe("isSkillValidationMethod", () => {
  it.each(CANONICAL)("accepts %s", (method) => {
    expect(isSkillValidationMethod(method)).toBe(true);
  });

  it.each([
    ["legacy observation", "observation"],
    ["legacy portfolio_review", "portfolio_review"],
    ["legacy certification", "certification"],
    ["legacy practical_test", "practical_test"],
    ["self_assessment (self path only)", "self_assessment"],
    ["empty string (placeholder option)", ""],
    ["upper-case variant", "Manager_Assessment"],
    ["leading whitespace", " manager_assessment"],
    ["trailing whitespace", "practical_observation "],
    ["UI label instead of key", "Practical observation"],
    ["prototype key", "constructor"],
    ["prototype key", "toString"],
  ])("rejects %s", (_name, value) => {
    expect(isSkillValidationMethod(value)).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isSkillValidationMethod(null)).toBe(false);
    expect(isSkillValidationMethod(undefined)).toBe(false);
  });
});

describe("drift guards", () => {
  it("matches the allow-list in the latest private.record_skill_validation migration", () => {
    const sql = latestValidationMigration();
    const fn = sql.slice(
      sql.indexOf("create or replace function private.record_skill_validation("),
    );
    const inList = fn.match(/not in \(([\s\S]*?)\)/);
    expect(inList).not.toBeNull();
    const tokens = [...(inList?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );
    expect(tokens.sort()).toEqual([...SKILL_VALIDATION_METHODS].sort());
  });

  it("the migration no longer defaults the method to manager_assessment", () => {
    const sql = latestValidationMigration();
    expect(sql).not.toMatch(
      /target_assessment_method text default 'manager_assessment'/,
    );
  });

  it("the dialog starts with no method and uses the shared enum", () => {
    const source = readFileSync(
      "src/components/people/skill-assessment-dialog.tsx",
      "utf8",
    );
    expect(source).toContain('useState<string>("")');
    expect(source).not.toContain('useState<string>("manager_assessment")');
    expect(source).toContain("SKILL_VALIDATION_METHODS");
    expect(source).not.toMatch(/"portfolio_review"|"practical_test"/);
  });

  it("the server action has no implicit manager_assessment fallback", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/people/actions.ts",
      "utf8",
    );
    expect(source).not.toContain('?? "manager_assessment"');
    expect(source).toContain("isSkillValidationMethod");
  });

  it("LeanAI product knowledge lists the canonical methods only", () => {
    const text = JSON.stringify(SKILLS_KNOWLEDGE_ARTICLES).toLowerCase();
    expect(text).not.toContain("portfolio review");
    expect(text).not.toContain("practical test");
    for (const label of Object.values(SKILL_VALIDATION_METHOD_LABELS)) {
      expect(text).toContain(label.toLowerCase());
    }
  });
});
