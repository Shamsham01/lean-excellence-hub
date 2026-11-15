import { describe, expect, it } from "vitest";

import {
  caseStatusAllowsLeanAiDrafting,
  isTerminalCaseStatus,
} from "@/lib/problem-solving/case-lifecycle";
import {
  deriveCaseProgressStage,
  PREMATURE_COUNTERMEASURES_NOTICE,
  resolveDisplayedCurrentStage,
} from "@/lib/problem-solving/derive-case-progress-stage";
import { PROBLEM_SOLVING_BUILTIN_METHOD_STAGES } from "@/lib/problem-solving/stage-draft";
import type { MethodStage } from "@/lib/problem-solving/stages";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

function methodStagesFor(methodCode: string): MethodStage[] {
  const config = PROBLEM_SOLVING_BUILTIN_METHOD_STAGES.find(
    (row) => row.method === methodCode,
  );
  if (!config) {
    throw new Error(`Unknown method ${methodCode}`);
  }
  return config.stages.map((semanticKey, index) => ({
    id: `${methodCode}-${semanticKey}`,
    title: semanticKey,
    semantic_stage_key: semanticKey,
    description: null,
    display_order: index + 1,
  }));
}

const stages: MethodStage[] = [
  {
    id: "s1",
    title: "Define the problem",
    semantic_stage_key: "DEFINE",
    description: null,
    display_order: 1,
  },
  {
    id: "s-rca",
    title: "Cause analysis",
    semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
    description: null,
    display_order: 4,
  },
  {
    id: "s-cm",
    title: "Countermeasures",
    semantic_stage_key: "COUNTERMEASURES",
    description: null,
    display_order: 5,
  },
  {
    id: "s-impl",
    title: "Implementation",
    semantic_stage_key: "IMPLEMENTATION",
    description: null,
    display_order: 6,
  },
  {
    id: "s-eff",
    title: "Effectiveness",
    semantic_stage_key: "EFFECTIVENESS_CHECK",
    description: null,
    display_order: 7,
  },
  {
    id: "s-sus",
    title: "Sustainment",
    semantic_stage_key: "SUSTAINMENT",
    description: null,
    display_order: 8,
  },
];

const hypothesisProposed = {
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
};

const hypothesisVerified = {
  ...hypothesisProposed,
  id: "h2",
  status: "verified",
};

const baseDetail = {
  problem_statement: "Gap on line",
  target_condition: "Target",
  hypotheses: [hypothesisProposed],
  countermeasures: [],
  actions: [],
  effectiveness_checks: [],
  sustainment_items: [],
  status: "active",
  current_stage: stages[1]!,
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
    const { stage } = deriveCaseProgressStage(stages, baseDetail, 0, 0);
    expect(stage?.semantic_stage_key).toBe("ROOT_CAUSE_ANALYSIS");
  });

  it("does not derive implementation from containment-only actions", () => {
    const { stage } = deriveCaseProgressStage(
      stages,
      {
        ...baseDetail,
        hypotheses: [hypothesisVerified],
        countermeasures: [
          {
            id: "cm1",
            title: "Fix seal",
            description: null,
            rationale: null,
            status: "proposed",
            proposed_by_membership_id: "m1",
            selected_by_membership_id: null,
            selected_at: null,
            selected_rationale: null,
            rejected_by_membership_id: null,
            rejected_at: null,
            rejected_rationale: null,
            created_at: "2026-01-01T00:00:00Z",
            cause_links: [],
            evidence_links: [],
          },
        ],
        actions: [
          {
            id: "a1",
            title: "Contain batch",
            description: null,
            status: "open",
            priority: "medium",
            due_at: null,
            completed_at: null,
            created_by_membership_id: "m1",
            context_role: "containment",
            countermeasure_id: null,
            containment_id: "c1",
            sustainment_item_id: null,
            created_at: "2026-01-01T00:00:00Z",
            assignees: [],
          },
        ],
      },
      0,
      0,
    );
    expect(stage?.semantic_stage_key).not.toBe("IMPLEMENTATION");
    expect(stage?.semantic_stage_key).toBe("COUNTERMEASURES");
  });

  it("keeps RCA with notice when countermeasures exist without verified cause", () => {
    const { stage, prematureCountermeasuresNotice } = deriveCaseProgressStage(
      stages,
      {
        ...baseDetail,
        countermeasures: [
          {
            id: "cm1",
            title: "Fix seal",
            description: null,
            rationale: null,
            status: "proposed",
            proposed_by_membership_id: "m1",
            selected_by_membership_id: null,
            selected_at: null,
            selected_rationale: null,
            rejected_by_membership_id: null,
            rejected_at: null,
            rejected_rationale: null,
            created_at: "2026-01-01T00:00:00Z",
            cause_links: [],
            evidence_links: [],
          },
        ],
      },
      0,
      0,
    );
    expect(stage?.semantic_stage_key).toBe("ROOT_CAUSE_ANALYSIS");
    expect(prematureCountermeasuresNotice).toBe(true);
    const resolved = resolveDisplayedCurrentStage(
      stages,
      {
        ...baseDetail,
        countermeasures: [
          {
            id: "cm1",
            title: "Fix seal",
            description: null,
            rationale: null,
            status: "proposed",
            proposed_by_membership_id: "m1",
            selected_by_membership_id: null,
            selected_at: null,
            selected_rationale: null,
            rejected_by_membership_id: null,
            rejected_at: null,
            rejected_rationale: null,
            created_at: "2026-01-01T00:00:00Z",
            cause_links: [],
            evidence_links: [],
          },
        ],
      } as unknown as ProblemSolvingCaseDetail,
      0,
      0,
    );
    expect(resolved.prematureCountermeasuresNotice).toBe(true);
    expect(PREMATURE_COUNTERMEASURES_NOTICE).toBe(
      "Countermeasures started before a cause was verified.",
    );
  });

  it("advances to countermeasures and implementation only after verified cause", () => {
    const withCmAction = {
      ...baseDetail,
      hypotheses: [hypothesisVerified],
      countermeasures: [
        {
          id: "cm1",
          title: "Fix seal",
          description: null,
          rationale: null,
          status: "proposed",
          proposed_by_membership_id: "m1",
          selected_by_membership_id: null,
          selected_at: null,
          selected_rationale: null,
          rejected_by_membership_id: null,
          rejected_at: null,
          rejected_rationale: null,
          created_at: "2026-01-01T00:00:00Z",
          cause_links: [],
          evidence_links: [],
        },
      ],
      actions: [
        {
          id: "a1",
          title: "Install fix",
          description: null,
          status: "open",
          priority: "medium",
          due_at: null,
          completed_at: null,
          created_by_membership_id: "m1",
          context_role: "countermeasure",
          countermeasure_id: "cm1",
          containment_id: null,
          sustainment_item_id: null,
          created_at: "2026-01-01T00:00:00Z",
          assignees: [],
        },
      ],
    };
    const { stage, prematureCountermeasuresNotice } = deriveCaseProgressStage(
      stages,
      withCmAction,
      0,
      0,
    );
    expect(prematureCountermeasuresNotice).toBe(false);
    expect(stage?.semantic_stage_key).toBe("IMPLEMENTATION");
  });

  it("does not derive sustainment without a passing effectiveness check", () => {
    const { stage } = deriveCaseProgressStage(
      stages,
      {
        ...baseDetail,
        hypotheses: [hypothesisVerified],
        effectiveness_checks: [
          {
            id: "e1",
            criterion: "Defect rate",
            baseline_description: null,
            target_description: null,
            baseline_numeric: null,
            target_numeric: null,
            actual_numeric: null,
            unit: null,
            observation_window_start: null,
            observation_window_end: null,
            due_date: null,
            result: null,
            verified_by_membership_id: null,
            verified_at: null,
            created_by_membership_id: "m1",
            created_at: "2026-01-01T00:00:00Z",
            evidence_links: [],
          },
        ],
        sustainment_items: [
          {
            id: "s1",
            what: "Audit standard",
            owner_membership_id: "m1",
            check_method: "Walk",
            follow_up_date: null,
            result: null,
            training_session_id: null,
            schedule_definition_id: null,
            evidence: null,
            created_by_membership_id: "m1",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      0,
      0,
    );
    expect(stage?.semantic_stage_key).toBe("EFFECTIVENESS_CHECK");
  });

  describe.each(["rapid_rca", "five_why", "rapid_improvement"] as const)(
    "non-A3 method %s",
    (methodCode) => {
      const methodStages = methodStagesFor(methodCode);

      it("maps target condition progress to the furthest available stage below it", () => {
        const { stage } = deriveCaseProgressStage(
          methodStages,
          {
            ...baseDetail,
            target_condition: "Within 2 ppm",
            hypotheses: [],
            current_stage: methodStages[0]!,
          },
          1,
          0,
        );
        const expected =
          methodCode === "rapid_rca" ? "CURRENT_CONDITION" : "DEFINE";
        expect(stage?.semantic_stage_key).toBe(expected);
      });

      it("maps implementation progress to countermeasures when implementation is absent", () => {
        const countermeasure = {
          id: "cm1",
          title: "Fix seal",
          description: null,
          rationale: null,
          status: "proposed" as const,
          proposed_by_membership_id: "m1",
          selected_by_membership_id: null,
          selected_at: null,
          selected_rationale: null,
          rejected_by_membership_id: null,
          rejected_at: null,
          rejected_rationale: null,
          created_at: "2026-01-01T00:00:00Z",
          cause_links: [],
          evidence_links: [],
        };
        const countermeasureAction = {
          id: "a1",
          title: "Install fix",
          description: null,
          status: "open",
          priority: "medium",
          due_at: null,
          completed_at: null,
          created_by_membership_id: "m1",
          context_role: "countermeasure" as const,
          countermeasure_id: "cm1",
          containment_id: null,
          sustainment_item_id: null,
          created_at: "2026-01-01T00:00:00Z",
          assignees: [],
        };
        const { stage } = deriveCaseProgressStage(
          methodStages,
          {
            ...baseDetail,
            hypotheses: [hypothesisVerified],
            countermeasures: [countermeasure],
            actions: [countermeasureAction],
            current_stage: methodStages[0]!,
          },
          0,
          0,
        );
        expect(stage?.semantic_stage_key).toBe("COUNTERMEASURES");
      });

      it("maps sustainment progress to effectiveness check when sustainment stage is absent", () => {
        const { stage } = deriveCaseProgressStage(
          methodStages,
          {
            ...baseDetail,
            hypotheses: [hypothesisVerified],
            effectiveness_checks: [
              {
                id: "e1",
                criterion: "Defect rate",
                baseline_description: null,
                target_description: null,
                baseline_numeric: null,
                target_numeric: null,
                actual_numeric: null,
                unit: null,
                observation_window_start: null,
                observation_window_end: null,
                due_date: null,
                result: "pass",
                verified_by_membership_id: "m1",
                verified_at: "2026-01-02T00:00:00Z",
                created_by_membership_id: "m1",
                created_at: "2026-01-01T00:00:00Z",
                evidence_links: [],
              },
            ],
            sustainment_items: [
              {
                id: "s1",
                what: "Audit",
                owner_membership_id: "m1",
                check_method: "Walk",
                follow_up_date: null,
                result: null,
                training_session_id: null,
                schedule_definition_id: null,
                evidence: null,
                created_by_membership_id: "m1",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            current_stage: methodStages[0]!,
          },
          0,
          0,
        );
        expect(stage?.semantic_stage_key).toBe("EFFECTIVENESS_CHECK");
      });
    },
  );
});
