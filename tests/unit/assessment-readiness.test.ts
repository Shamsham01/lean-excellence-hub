import { describe, expect, it } from "vitest";

import {
  buildAssessmentReadiness,
  remainingRequiredLabel,
  reviewMissingLabel,
} from "@/modules/maturity/assessment-readiness";
import type { AssessmentPillar } from "@/modules/maturity/assessment-workspace-types";

const pillars: AssessmentPillar[] = [
  {
    id: "pillar-1",
    name: "Leadership & Governance",
    criteria: [
      {
        id: "c-roles",
        name: "Clear Roles & Responsibilities",
        description: null,
        guidance: "Define roles",
        questions: [
          {
            id: "q1",
            prompt: "Are roles clear?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: true,
            help_text: null,
            contributes_to_score: true,
            position: 1,
          },
        ],
      },
      {
        id: "c-strategy",
        name: "Strategy & Priorities",
        description: null,
        guidance: null,
        questions: [
          {
            id: "q2",
            prompt: "Are priorities visible?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: true,
            position: 1,
          },
          {
            id: "q3",
            prompt: "Is strategy reviewed?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: true,
            position: 2,
          },
          {
            id: "q4",
            prompt: "Optional note",
            question_type: "long_text",
            is_required: false,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: false,
            position: 3,
          },
        ],
      },
    ],
  },
];

describe("assessment readiness", () => {
  it("counts required responses and remaining question context from server-shaped data", () => {
    const readiness = buildAssessmentReadiness(pillars, {
      q1: { number_value: 2 },
      q2: { number_value: 1 },
    });

    expect(readiness.totalRequired).toBe(3);
    expect(readiness.answeredRequired).toBe(2);
    expect(readiness.remainingRequired).toBe(1);
    expect(readiness.completionPercent).toBe(67);
    expect(readiness.ready).toBe(false);
    expect(readiness.remaining).toEqual([
      {
        questionId: "q3",
        criterionId: "c-strategy",
        pillarId: "pillar-1",
        pillarName: "Leadership & Governance",
        criterionName: "Strategy & Priorities",
        prompt: "Is strategy reviewed?",
      },
    ]);
    expect(readiness.criterionCompletions["c-roles"]?.state).toBe("complete");
    expect(readiness.criterionCompletions["c-strategy"]?.state).toBe("partial");
    expect(readiness.criterionCompletions["c-strategy"]?.answeredRequired).toBe(
      1,
    );
  });

  it("treats N/A as an answered required question", () => {
    const readiness = buildAssessmentReadiness(pillars, {
      q1: { is_not_applicable: true },
      q2: { number_value: 3 },
      q3: { number_value: 2 },
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.remainingRequired).toBe(0);
  });

  it("labels remaining work for the assessor", () => {
    expect(remainingRequiredLabel(3)).toBe("3 required responses remaining");
    expect(reviewMissingLabel(3)).toBe("Review 3 missing responses");
    expect(remainingRequiredLabel(1)).toBe("1 required response remaining");
  });
});
