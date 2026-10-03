import { describe, expect, it, vi } from "vitest";

import {
  ASSESSMENT_NAV_SCROLL_BEHAVIOR,
  buildAssessmentNavPosition,
  formatAssessmentNavPosition,
  scrollAssessmentTarget,
} from "@/modules/maturity/assessment-navigation";
import type { AssessmentPillar } from "@/modules/maturity/assessment-workspace-types";

const pillars: AssessmentPillar[] = [
  {
    id: "pillar-1",
    name: "Leadership & Governance",
    criteria: [
      {
        id: "c1",
        name: "Clear Roles",
        description: null,
        guidance: null,
        questions: [],
      },
      {
        id: "c2",
        name: "Strategy",
        description: null,
        guidance: null,
        questions: [],
      },
    ],
  },
  {
    id: "pillar-2",
    name: "Community & Operations",
    criteria: [
      {
        id: "c3",
        name: "Community Engagement",
        description: null,
        guidance: null,
        questions: [],
      },
      {
        id: "c4",
        name: "Daily Management",
        description: null,
        guidance: null,
        questions: [],
      },
      {
        id: "c5",
        name: "Standard Work",
        description: null,
        guidance: null,
        questions: [],
      },
    ],
  },
  {
    id: "pillar-3",
    name: "Results",
    criteria: [
      {
        id: "c6",
        name: "Performance",
        description: null,
        guidance: null,
        questions: [],
      },
    ],
  },
];

describe("assessment navigation position", () => {
  it("reports pillar and within-pillar criterion indexes separately from completion", () => {
    expect(buildAssessmentNavPosition(pillars, "c3")).toEqual({
      currentPillarIndex: 2,
      totalPillars: 3,
      currentCriterionIndexWithinPillar: 1,
      criteriaInCurrentPillar: 3,
      globalCriterionIndex: 3,
      totalCriteria: 6,
    });
    expect(
      formatAssessmentNavPosition(buildAssessmentNavPosition(pillars, "c3")),
    ).toBe("Pillar 2 of 3 · Criterion 1 of 3");
  });

  it("counts criteria within the current pillar, not across the whole assessment", () => {
    expect(
      formatAssessmentNavPosition(buildAssessmentNavPosition(pillars, "c1")),
    ).toBe("Pillar 1 of 3 · Criterion 1 of 2");
    expect(
      formatAssessmentNavPosition(buildAssessmentNavPosition(pillars, "c6")),
    ).toBe("Pillar 3 of 3 · Criterion 1 of 1");
  });
});

describe("assessment navigation scroll targeting", () => {
  it("uses an instant scroll behaviour", () => {
    expect(ASSESSMENT_NAV_SCROLL_BEHAVIOR).toBe("auto");
  });

  it("scrolls the criterion start anchor for criterion-only navigation", () => {
    const criterionTop = document.createElement("div");
    const question = document.createElement("article");
    question.setAttribute("data-question-id", "q-missing");
    const topScroll = vi.fn();
    const questionScroll = vi.fn();
    criterionTop.scrollIntoView = topScroll;
    question.scrollIntoView = questionScroll;
    document.body.append(criterionTop, question);

    scrollAssessmentTarget({ kind: "criterion-top" }, criterionTop);

    expect(topScroll).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(questionScroll).not.toHaveBeenCalled();
    criterionTop.remove();
    question.remove();
  });

  it("scrolls only the targeted question when a question id is supplied", () => {
    const criterionTop = document.createElement("div");
    const question = document.createElement("article");
    question.setAttribute("data-question-id", "q-missing");
    const topScroll = vi.fn();
    const questionScroll = vi.fn();
    criterionTop.scrollIntoView = topScroll;
    question.scrollIntoView = questionScroll;
    document.body.append(criterionTop, question);

    scrollAssessmentTarget(
      { kind: "question", questionId: "q-missing" },
      criterionTop,
    );

    expect(questionScroll).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
    expect(topScroll).not.toHaveBeenCalled();
    criterionTop.remove();
    question.remove();
  });
});
