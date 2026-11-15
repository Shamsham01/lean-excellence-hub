import { describe, expect, it } from "vitest";

import {
  caseStatusAllowsLeanAiDrafting,
  isTerminalCaseStatus,
} from "@/lib/problem-solving/case-lifecycle";
import { deriveCaseProgressStage } from "@/lib/problem-solving/derive-case-progress-stage";
import type { MethodStage } from "@/lib/problem-solving/stages";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

const stages: MethodStage[] = [
  {
    id: "s1",
    title: "Define the problem",
    semantic_stage_key: "DEFINE",
    description: null,
    display_order: 1,
  },
  {
    id: "s2",
    title: "Cause analysis",
    semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
    description: null,
    display_order: 4,
  },
];

const baseDetail = {
  problem_statement: "Gap on line",
  target_condition: null,
  hypotheses: [],
  countermeasures: [],
  actions: [],
  effectiveness_checks: [],
  sustainment_items: [],
  status: "active",
  current_stage: stages[0]!,
} satisfies Pick<
  ProblemSolvingCaseDetail,
  | "problem_statement"
  | "target_condition"
  | "hypotheses"
  | "countermeasures"
  | "actions"
  | "effectiveness_checks"
  | "sustainment_items"
  | "status"
  | "current_stage"
>;

describe("pps issue 408 lifecycle helpers", () => {
  it("treats closed and cancelled as terminal", () => {
    expect(isTerminalCaseStatus("closed")).toBe(true);
    expect(caseStatusAllowsLeanAiDrafting("active")).toBe(true);
    expect(caseStatusAllowsLeanAiDrafting("closed")).toBe(false);
  });

  it("derives progress at cause analysis when hypotheses exist", () => {
    const stage = deriveCaseProgressStage(stages, {
      ...baseDetail,
      hypotheses: [
        {
          id: "h1",
          statement: "Bad seal",
          category: "Machine",
          status: "proposed",
          rationale: null,
          verification_rationale: null,
          verified_by_membership_id: null,
          verified_at: null,
          rejection_rationale: null,
          rejected_by_membership_id: null,
          rejected_at: null,
          parent_hypothesis_id: null,
          created_by_membership_id: "m1",
          created_at: "2026-01-01T00:00:00Z",
          evidence_links: [],
        },
      ],
    }, 0, 0);
    expect(stage?.semantic_stage_key).toBe("ROOT_CAUSE_ANALYSIS");
  });
});