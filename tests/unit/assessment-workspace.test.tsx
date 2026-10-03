import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentWorkspace } from "@/components/maturity/assessment-workspace";
import { AUTHORING_STEP_CHANGE_EVENT } from "@/lib/authoring/authoring-query";
import { assessmentCriterionStorageKey } from "@/modules/maturity/assessment-criterion-state";
import type { AssessmentPillar } from "@/modules/maturity/assessment-workspace-types";
import {
  completeSelfAssessment,
  saveCriterionNote,
} from "@/app/(platform)/platform/maturity/actions";

vi.mock("@/app/(platform)/platform/maturity/actions", () => ({
  saveAssessmentAnswer: vi.fn(async () => ({ ok: true })),
  saveCriterionNote: vi.fn(async () => ({ ok: true })),
  saveQuestionNote: vi.fn(async () => ({ ok: true })),
  completeSelfAssessment: vi.fn(async () => ({
    error: "required maturity assessment questions are unanswered",
  })),
  submitAssessment: vi.fn(),
  beginAssessorReview: vi.fn(),
  approveAssessment: vi.fn(),
  publishOfficialResult: vi.fn(),
  createMaturityAction: vi.fn(),
  initiateEvidenceUpload: vi.fn(),
  confirmEvidenceUpload: vi.fn(),
  linkMaturityEvidence: vi.fn(),
}));

vi.mock("@/components/maturity/evidence-uploader", () => ({
  EvidenceUploader: () => <div data-testid="evidence-uploader" />,
}));

const pillars: AssessmentPillar[] = [
  {
    id: "pillar-1",
    name: "Leadership & Governance",
    criteria: [
      {
        id: "c1",
        name: "Clear Roles & Responsibilities",
        description: "Roles are defined",
        guidance: "Look for RACI evidence",
        questions: [
          {
            id: "q1",
            prompt: "Are roles clear?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: true,
            help_text: "Use the published levels",
            contributes_to_score: true,
            position: 1,
          },
        ],
      },
      {
        id: "c2",
        name: "Strategy & Priorities",
        description: null,
        guidance: "Strategy cadence",
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
        ],
      },
    ],
  },
];

const multiPillars: AssessmentPillar[] = [
  pillars[0]!,
  {
    id: "pillar-2",
    name: "Community & Operations",
    criteria: [
      {
        id: "c3",
        name: "Community Engagement",
        description: null,
        guidance: "Look for engagement cadence",
        questions: [
          {
            id: "q4",
            prompt: "Are communities engaged?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: true,
            position: 1,
          },
        ],
      },
      {
        id: "c4",
        name: "Daily Management",
        description: null,
        guidance: null,
        questions: [
          {
            id: "q5",
            prompt: "Is daily management visible?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: true,
            position: 1,
          },
        ],
      },
      {
        id: "c5",
        name: "Standard Work",
        description: null,
        guidance: null,
        questions: [
          {
            id: "q6",
            prompt: "Is standard work followed?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: true,
            position: 1,
          },
        ],
      },
    ],
  },
  {
    id: "pillar-3",
    name: "Results",
    criteria: [
      {
        id: "c6",
        name: "Performance Dialogue",
        description: null,
        guidance: null,
        questions: [
          {
            id: "q7",
            prompt: "Are results reviewed?",
            question_type: "score",
            is_required: true,
            allows_not_applicable: false,
            help_text: null,
            contributes_to_score: true,
            position: 1,
          },
        ],
      },
    ],
  },
];

const levels = [
  { level_number: 1, name: "Initial", guidance: "Ad hoc" },
  { level_number: 2, name: "Developing", guidance: "Repeatable" },
  { level_number: 3, name: "Established", guidance: "Managed" },
];

function renderWorkspace(
  overrides?: Partial<ComponentProps<typeof AssessmentWorkspace>>,
) {
  return render(
    <AssessmentWorkspace
      assessmentId="assess-1"
      status="in_progress"
      assessmentType="self"
      pillars={pillars}
      levels={levels}
      answers={{ q1: { number_value: 2 } }}
      criterionNotes={{}}
      questionNotes={{}}
      evidence={[]}
      canEdit
      lifecycle={{
        canCompleteSelf: true,
        canSubmitFormal: false,
        canBeginReview: false,
        canApprove: false,
        canPublish: false,
        canReturnForCorrection: false,
      }}
      {...overrides}
    />,
  );
}

function lastScrolledElement(scrolled: Element[]) {
  return scrolled.at(-1) as HTMLElement | undefined;
}

describe("AssessmentWorkspace", () => {
  let scrollIntoView: ReturnType<typeof vi.spyOn>;
  const scrolledElements: Element[] = [];

  afterEach(() => {
    cleanup();
    scrollIntoView.mockRestore();
  });

  beforeEach(() => {
    window.sessionStorage.clear();
    scrolledElements.length = 0;
    scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(function (this: Element) {
        scrolledElements.push(this);
      });
  });

  it("shows required-response completion rather than criterion position as the primary progress", () => {
    renderWorkspace();
    expect(screen.getByTestId("assessment-completion-count")).toHaveTextContent(
      "1 / 3 required responses",
    );
    expect(screen.getByTestId("remaining-required-count")).toHaveTextContent(
      "2 required responses remaining",
    );
    expect(
      screen.getByTestId("assessment-criterion-position"),
    ).toHaveTextContent("Pillar 1 of 1 · Criterion 1 of 2");
    expect(
      screen.getByTestId("assessment-desktop-nav-position"),
    ).toHaveTextContent("Pillar 1 of 1 · Criterion 1 of 2");
  });

  it("renders configured levels instead of a generic number field", () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: "1 Initial" })).toBeVisible();
    expect(screen.getByRole("button", { name: "2 Developing" })).toBeVisible();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("keeps framework guidance inside the workspace instead of a third column", () => {
    renderWorkspace();
    expect(screen.getByText("Scoring guidance")).toBeVisible();
    expect(screen.getByText("Criterion guidance")).toBeVisible();
    expect(screen.getByText("Level descriptors")).toBeVisible();
    expect(
      screen.queryByTestId("assessment-guidance-column"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-criterion-nav")).toBeInTheDocument();
  });

  it("opens readiness feedback instead of throwing when completion is blocked", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("review-missing-responses"));
    expect(screen.getByTestId("assessment-readiness-panel")).toBeVisible();
    expect(screen.getByTestId("assessment-readiness-panel")).toHaveTextContent(
      "2 required responses remaining",
    );
    fireEvent.click(screen.getByTestId("go-to-first-missing"));
    await waitFor(() => {
      expect(
        screen.getByTestId("assessment-criterion-position"),
      ).toHaveTextContent("Pillar 1 of 1 · Criterion 2 of 2");
    });
    expect(screen.getByText("Are priorities visible?")).toBeVisible();
    expect(
      screen.queryByTestId("workspace-load-error"),
    ).not.toBeInTheDocument();
  });

  it("navigates with Previous, Next, and Next incomplete", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("next-criterion"));
    await waitFor(() => {
      expect(screen.getByText("Strategy & Priorities")).toBeVisible();
    });
    fireEvent.click(screen.getByTestId("previous-criterion"));
    await waitFor(() => {
      expect(screen.getByText("Clear Roles & Responsibilities")).toBeVisible();
    });
    fireEvent.click(screen.getByTestId("next-incomplete"));
    await waitFor(() => {
      expect(screen.getByText("Strategy & Priorities")).toBeVisible();
    });
  });

  it("opens the mobile Criteria drawer", () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("criteria-drawer-open"));
    expect(screen.getByTestId("criteria-drawer")).toBeVisible();
    expect(screen.getByTestId("criteria-drawer")).toHaveTextContent(
      "Strategy & Priorities",
    );
  });

  it("keeps N/A available and collapses the action form", () => {
    renderWorkspace();
    expect(screen.getByTestId("mark-not-applicable")).toBeVisible();
    expect(screen.getByTestId("create-improvement-action")).toBeVisible();
    expect(screen.queryByLabelText("Create action")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("create-improvement-action"));
    expect(screen.getByLabelText("Create action")).toBeVisible();
  });

  it("shows a read-only completed state", () => {
    renderWorkspace({
      status: "completed",
      canEdit: false,
      lifecycle: {
        canCompleteSelf: false,
        canSubmitFormal: false,
        canBeginReview: false,
        canApprove: false,
        canPublish: false,
        canReturnForCorrection: false,
      },
    });
    expect(screen.getByTestId("assessment-readonly-banner")).toHaveTextContent(
      "Self assessment completed",
    );
    expect(
      screen.queryByTestId("complete-self-assessment"),
    ).not.toBeInTheDocument();
  });

  it("marks criterion completion in the compact navigator", () => {
    renderWorkspace({
      answers: {
        q1: { number_value: 2 },
        q2: { number_value: 1 },
      },
    });
    expect(screen.getByTestId("criterion-nav-c1")).toHaveAttribute(
      "data-completion-state",
      "complete",
    );
    expect(screen.getByTestId("criterion-nav-c1")).toHaveTextContent("1/1");
    expect(screen.getByTestId("criterion-nav-c2")).toHaveAttribute(
      "data-completion-state",
      "partial",
    );
    expect(screen.getByTestId("criterion-nav-c2")).toHaveTextContent("1/2");
  });

  it("surfaces a database readiness rejection without crashing the workspace", async () => {
    vi.mocked(completeSelfAssessment).mockResolvedValueOnce({
      error: "required maturity assessment questions are unanswered",
    });

    renderWorkspace({
      answers: {
        q1: { number_value: 2 },
        q2: { number_value: 3 },
        q3: { number_value: 1 },
      },
    });

    fireEvent.click(screen.getByTestId("complete-self-assessment"));
    await waitFor(() => {
      expect(screen.getByTestId("lifecycle-action-error")).toHaveTextContent(
        "Required responses are still missing",
      );
    });
    expect(
      screen.queryByTestId("workspace-load-error"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("assessment-workspace")).toBeVisible();
  });

  it("keeps formal reviewer actions available during assessor review", () => {
    renderWorkspace({
      assessmentType: "formal",
      status: "assessor_review",
      canEdit: true,
      answers: {
        q1: { number_value: 2 },
        q2: { number_value: 3 },
        q3: { number_value: 1 },
      },
      lifecycle: {
        canCompleteSelf: false,
        canSubmitFormal: false,
        canBeginReview: false,
        canApprove: true,
        canPublish: false,
        canReturnForCorrection: true,
      },
    });

    expect(screen.getByTestId("approve-assessment")).toBeVisible();
    expect(screen.getByRole("button", { name: "1 Initial" })).toBeEnabled();
  });

  it("shows a compact mobile context header for the current pillar and criterion", () => {
    renderWorkspace({
      pillars: multiPillars,
      initialCriterionId: "c3",
      answers: {
        q1: { number_value: 2 },
        q2: { number_value: 1 },
        q3: { number_value: 1 },
      },
    });

    expect(screen.getByTestId("assessment-mobile-context")).toHaveClass(
      "sticky",
      "lg:hidden",
    );
    expect(
      screen.getByTestId("assessment-mobile-pillar-name"),
    ).toHaveTextContent("Community & Operations");
    expect(
      screen.getByTestId("assessment-mobile-criterion-name"),
    ).toHaveTextContent("Community Engagement");
    expect(
      screen.getByTestId("assessment-criterion-position"),
    ).toHaveTextContent("Pillar 2 of 3 · Criterion 1 of 3");
    expect(
      screen.getByTestId("assessment-mobile-completion"),
    ).toHaveTextContent("3 / 7 complete · 43%");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps desktop progress available without duplicating it on mobile", () => {
    renderWorkspace();
    const desktop = screen.getByTestId("assessment-desktop-progress");
    const mobile = screen.getByTestId("assessment-mobile-context");
    expect(desktop).toHaveClass("hidden", "lg:flex");
    expect(mobile).toHaveClass("lg:hidden");
    expect(desktop).toHaveTextContent("1 / 3 required responses");
    expect(desktop).toHaveTextContent("33% complete");
    expect(
      screen.getByTestId("assessment-desktop-nav-position"),
    ).toHaveTextContent("Pillar 1 of 1 · Criterion 1 of 2");
    expect(
      mobile.querySelectorAll('[aria-label="Assessment progress"]'),
    ).toHaveLength(1);
    expect(
      desktop.querySelectorAll('[aria-label="Assessment progress"]'),
    ).toHaveLength(1);
  });

  it("does not auto-scroll on the initial workspace load", () => {
    renderWorkspace();
    expect(
      screen.getByTestId("assessment-mobile-criterion-name"),
    ).toHaveTextContent("Clear Roles & Responsibilities");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("restores a persisted criterion without scrolling during hydration", () => {
    const storedId = "c2";
    window.sessionStorage.setItem(
      assessmentCriterionStorageKey("assess-1"),
      storedId,
    );
    renderWorkspace({ initialCriterionId: storedId });
    expect(
      screen.getByTestId("assessment-mobile-criterion-name"),
    ).toHaveTextContent("Strategy & Priorities");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("flushes saves, changes criterion, and scrolls to the start on Next", async () => {
    const locationEvents: Event[] = [];
    window.addEventListener(AUTHORING_STEP_CHANGE_EVENT, (event) => {
      locationEvents.push(event);
    });
    renderWorkspace();
    fireEvent.change(screen.getByTestId("assessor-comment"), {
      target: { value: "Roles observation" },
    });
    fireEvent.click(screen.getByTestId("next-criterion"));

    await waitFor(() => {
      expect(
        screen.getByTestId("assessment-mobile-criterion-name"),
      ).toHaveTextContent("Strategy & Priorities");
    });
    expect(saveCriterionNote).toHaveBeenCalled();
    expect(lastScrolledElement(scrolledElements)).toHaveAttribute(
      "data-testid",
      "assessment-criterion-top",
    );
    expect(locationEvents.length).toBeGreaterThan(0);
    expect(window.location.search).toContain("criterion=c2");
  });

  it("scrolls to the criterion start after Previous", async () => {
    renderWorkspace({ initialCriterionId: "c2" });
    scrollIntoView.mockClear();
    scrolledElements.length = 0;
    fireEvent.click(screen.getByTestId("previous-criterion"));
    await waitFor(() => {
      expect(
        screen.getByTestId("assessment-mobile-criterion-name"),
      ).toHaveTextContent("Clear Roles & Responsibilities");
    });
    expect(lastScrolledElement(scrolledElements)).toHaveAttribute(
      "data-testid",
      "assessment-criterion-top",
    );
  });

  it("closes the Criteria drawer and scrolls the selected criterion to the top", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("criteria-drawer-open"));
    expect(screen.getByTestId("criteria-drawer")).toBeVisible();
    fireEvent.click(screen.getByTestId("criteria-drawer-item-c2"));
    await waitFor(() => {
      expect(
        screen.getByTestId("assessment-mobile-criterion-name"),
      ).toHaveTextContent("Strategy & Priorities");
    });
    expect(screen.queryByTestId("criteria-drawer")).not.toBeInTheDocument();
    expect(lastScrolledElement(scrolledElements)).toHaveAttribute(
      "data-testid",
      "assessment-criterion-top",
    );
  });

  it("scrolls to the criterion start from the desktop navigator", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("criterion-nav-c2"));
    await waitFor(() => {
      expect(
        screen.getByTestId("assessment-mobile-criterion-name"),
      ).toHaveTextContent("Strategy & Priorities");
    });
    expect(lastScrolledElement(scrolledElements)).toHaveAttribute(
      "data-testid",
      "assessment-criterion-top",
    );
  });

  it("scrolls and highlights a specific question for Next incomplete", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("next-incomplete"));
    await waitFor(() => {
      expect(
        screen.getByTestId("assessment-mobile-criterion-name"),
      ).toHaveTextContent("Strategy & Priorities");
    });
    const scrolled = lastScrolledElement(scrolledElements);
    expect(scrolled).toHaveAttribute("data-question-id", "q2");
    expect(scrolled).toHaveAttribute("data-highlighted", "true");
    expect(scrolled).not.toHaveAttribute(
      "data-testid",
      "assessment-criterion-top",
    );
    expect(screen.getByTestId("question-card-q2")).toHaveClass("ring-2");
  });

  it("scrolls and highlights a specific question for Go to first missing", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId("review-missing-responses"));
    fireEvent.click(screen.getByTestId("go-to-first-missing"));
    await waitFor(() => {
      expect(lastScrolledElement(scrolledElements)).toHaveAttribute(
        "data-question-id",
        "q2",
      );
    });
    expect(lastScrolledElement(scrolledElements)).not.toHaveAttribute(
      "data-testid",
      "assessment-criterion-top",
    );
    expect(screen.getByText("Are priorities visible?")).toBeVisible();
  });
});
