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

  it("scrolls the criterion start anchor inside the platform main viewport", () => {
    const viewport = document.createElement("div");
    viewport.className = "platform-main-viewport";
    Object.defineProperty(viewport, "clientHeight", { value: 400 });
    Object.defineProperty(viewport, "scrollHeight", { value: 2000 });
    viewport.scrollTop = 500;

    const criterionTop = document.createElement("div");
    criterionTop.getBoundingClientRect = () =>
      ({
        top: 180,
        height: 1,
        left: 0,
        right: 0,
        bottom: 181,
        width: 100,
        x: 0,
        y: 180,
        toJSON: () => ({}),
      }) as DOMRect;
    viewport.getBoundingClientRect = () =>
      ({
        top: 0,
        height: 400,
        left: 0,
        right: 0,
        bottom: 400,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    viewport.append(criterionTop);
    document.body.append(viewport);

    scrollAssessmentTarget({ kind: "criterion-top" }, criterionTop);

    expect(viewport.scrollTop).toBe(680);
    viewport.remove();
  });

  it("scrolls only the targeted question inside the platform main viewport", () => {
    const viewport = document.createElement("div");
    viewport.className = "platform-main-viewport";
    Object.defineProperty(viewport, "clientHeight", { value: 500 });
    Object.defineProperty(viewport, "scrollHeight", { value: 2400 });
    viewport.scrollTop = 300;

    const question = document.createElement("article");
    question.setAttribute("data-question-id", "q-missing");
    question.getBoundingClientRect = () =>
      ({
        top: 520,
        height: 120,
        left: 0,
        right: 0,
        bottom: 640,
        width: 100,
        x: 0,
        y: 520,
        toJSON: () => ({}),
      }) as DOMRect;
    viewport.getBoundingClientRect = () =>
      ({
        top: 0,
        height: 500,
        left: 0,
        right: 0,
        bottom: 500,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    viewport.append(question);
    document.body.append(viewport);

    scrollAssessmentTarget({ kind: "question", questionId: "q-missing" }, null);

    expect(viewport.scrollTop).toBe(630);
    viewport.remove();
  });
});
