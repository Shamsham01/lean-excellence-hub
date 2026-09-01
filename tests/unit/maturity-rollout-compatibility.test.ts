import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("maturity rollout compatibility", () => {
  it("frontend startAssessment uses canonical 5-arg scope-aware RPC", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/maturity/actions.ts",
      "utf8",
    );

    const startAssessmentStart = source.indexOf(
      "export async function startAssessment",
    );
    const nextExport = source.indexOf(
      "\nexport async function ",
      startAssessmentStart + 1,
    );
    const startAssessmentSource = source.slice(
      startAssessmentStart,
      nextExport === -1 ? undefined : nextExport,
    );

    expect(startAssessmentSource).toContain("target_assessment_scope_type");
    expect(startAssessmentSource).toContain('"start_maturity_assessment"');
    expect(startAssessmentSource).not.toContain(
      "target_lead_assessor_membership_id",
    );
    expect(startAssessmentSource).toMatch(
      /rpc\("start_maturity_assessment",\s*\{[\s\S]*target_assessment_scope_type[\s\S]*\}\s*\)/,
    );
  });
});
