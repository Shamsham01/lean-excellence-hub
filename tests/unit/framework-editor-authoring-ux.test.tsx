import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentProps } from "react";

import {
  deleteMaturityCriterion,
  deleteMaturityQuestion,
  moveMaturityCriterion,
  moveMaturityQuestion,
  updateMaturityModelMetadata,
} from "@/app/(platform)/platform/maturity/actions";
import { FrameworkEditor } from "@/components/maturity/framework-editor";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/app/(platform)/platform/maturity/actions", () => ({
  addMaturityCriterion: vi.fn(),
  addMaturityLevel: vi.fn(),
  addMaturityPillar: vi.fn(),
  addMaturityQuestion: vi.fn(),
  deleteMaturityCriterion: vi.fn(),
  deleteMaturityQuestion: vi.fn(),
  linkCriterionQuestion: vi.fn(),
  moveMaturityCriterion: vi.fn(),
  moveMaturityQuestion: vi.fn(),
  publishMaturityModel: vi.fn(),
  setFrameworkAssessmentScopes: vi.fn(),
  updateMaturityCriterion: vi.fn(),
  updateMaturityLevel: vi.fn(),
  updateMaturityModelMetadata: vi.fn(),
  updateMaturityPillar: vi.fn(),
  updateMaturityQuestion: vi.fn(),
}));

const updateMetadata = vi.mocked(updateMaturityModelMetadata);
const moveCriterion = vi.mocked(moveMaturityCriterion);
const moveQuestion = vi.mocked(moveMaturityQuestion);
const deleteCriterion = vi.mocked(deleteMaturityCriterion);
const deleteQuestion = vi.mocked(deleteMaturityQuestion);

function renderEditor(
  props: Partial<ComponentProps<typeof FrameworkEditor>> = {},
) {
  return render(
    <FrameworkEditor
      modelId="model-1"
      modelName="Demo framework"
      modelDescription="Initial description"
      versionId="version-1"
      versionNumber={1}
      assessmentScopes={["site"]}
      levels={[]}
      pillars={[]}
      criteria={[]}
      questions={[]}
      {...props}
    />,
  );
}

describe("FrameworkEditor authoring UX", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateMetadata.mockReset();
    moveCriterion.mockReset();
    moveQuestion.mockReset();
    deleteCriterion.mockReset();
    deleteQuestion.mockReset();
    updateMetadata.mockResolvedValue({ ok: true });
    window.history.replaceState({}, "", "/platform/maturity/models/model-1");
  });

  afterEach(() => {
    cleanup();
  });

  it("persists the active step in the URL and restores it on reload", () => {
    renderEditor();

    fireEvent.click(screen.getByTestId("framework-step-levels"));

    expect(window.location.search).toBe("?step=levels");
    expect(screen.getByLabelText("Level name")).toBeInTheDocument();

    window.history.replaceState(
      {},
      "",
      "/platform/maturity/models/model-1?step=levels",
    );

    cleanup();
    renderEditor({ initialAuthoringStep: "levels" });

    expect(screen.getByLabelText("Level name")).toBeInTheDocument();
    expect(
      screen.queryByTestId("framework-details-form"),
    ).not.toBeInTheDocument();
  });

  it("renders a server-derived initial step without reading window on mount", () => {
    window.history.replaceState(
      {},
      "",
      "/platform/maturity/models/model-1?step=levels",
    );

    renderEditor({ initialAuthoringStep: "details" });

    expect(screen.getByTestId("framework-details-form")).toBeInTheDocument();
    expect(screen.queryByLabelText("Level name")).not.toBeInTheDocument();
  });

  it("shows explicit save confirmation after a successful save", async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Updated framework" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save framework details" }),
    );

    await waitFor(() => {
      expect(updateMetadata).toHaveBeenCalled();
    });

    expect(refresh).toHaveBeenCalled();
    expect(screen.getByTestId("authoring-save-feedback")).toHaveTextContent(
      "Saved.",
    );
  });

  it("reparents a draft criterion to another pillar", async () => {
    moveCriterion.mockResolvedValue({ ok: true });
    renderEditor({
      initialAuthoringStep: "criteria",
      pillars: [
        {
          id: "pillar-safety",
          name: "Safety",
          position: 1,
          section_id: "section-safety",
          description: null,
          guidance: null,
        },
        {
          id: "pillar-ps",
          name: "Problem Solving",
          position: 2,
          section_id: "section-ps",
          description: null,
          guidance: null,
        },
      ],
      criteria: [
        {
          id: "criterion-wrong",
          name: "Wrong place",
          pillar_id: "pillar-safety",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
    });

    fireEvent.change(screen.getByLabelText("Criterion pillar"), {
      target: { value: "pillar-ps" },
    });
    fireEvent.submit(screen.getByTestId("edit-criterion-criterion-wrong"));

    await waitFor(() => {
      expect(moveCriterion).toHaveBeenCalledWith(
        "criterion-wrong",
        "pillar-ps",
        undefined,
        "model-1",
      );
    });
  });

  it("reparents a draft question and confirms criterion deletion", async () => {
    moveQuestion.mockResolvedValue({ ok: true });
    deleteCriterion.mockResolvedValue({ ok: true });
    deleteQuestion.mockResolvedValue({ ok: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderEditor({
      initialAuthoringStep: "questions",
      pillars: [
        {
          id: "pillar-safety",
          name: "Safety",
          position: 1,
          section_id: "section-safety",
          description: null,
          guidance: null,
        },
        {
          id: "pillar-ps",
          name: "Problem Solving",
          position: 2,
          section_id: "section-ps",
          description: null,
          guidance: null,
        },
      ],
      criteria: [
        {
          id: "criterion-safety",
          name: "Safety criterion",
          pillar_id: "pillar-safety",
          position: 1,
          description: null,
          guidance: null,
        },
        {
          id: "criterion-ps",
          name: "Problem Solving",
          pillar_id: "pillar-ps",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
      questions: [
        {
          id: "question-1",
          prompt: "Rate problem solving",
          criterion_id: "criterion-safety",
          position: 1,
        },
      ],
    });

    fireEvent.change(screen.getByLabelText("Question criterion"), {
      target: { value: "criterion-ps" },
    });
    fireEvent.submit(screen.getByTestId("edit-question-question-1"));

    await waitFor(() => {
      expect(moveQuestion).toHaveBeenCalledWith(
        "question-1",
        "criterion-ps",
        undefined,
        "model-1",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete question" }));
    await waitFor(() => {
      expect(deleteQuestion).toHaveBeenCalledWith("question-1", "model-1");
    });

    cleanup();
    renderEditor({
      initialAuthoringStep: "criteria",
      pillars: [
        {
          id: "pillar-safety",
          name: "Safety",
          position: 1,
          section_id: "section-safety",
          description: null,
          guidance: null,
        },
      ],
      criteria: [
        {
          id: "criterion-safety",
          name: "Safety criterion",
          pillar_id: "pillar-safety",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
      questions: [
        {
          id: "question-1",
          prompt: "Rate problem solving",
          criterion_id: "criterion-safety",
          position: 1,
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete criterion" }));
    await waitFor(() => {
      expect(deleteCriterion).toHaveBeenCalledWith(
        "criterion-safety",
        "model-1",
      );
    });
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("groups questions by pillar and criterion instead of global position", () => {
    renderEditor({
      initialAuthoringStep: "questions",
      pillars: [
        {
          id: "pillar-a",
          name: "Pillar A",
          position: 1,
          section_id: "section-a",
          description: null,
          guidance: null,
        },
        {
          id: "pillar-b",
          name: "Pillar B",
          position: 2,
          section_id: "section-b",
          description: null,
          guidance: null,
        },
      ],
      criteria: [
        {
          id: "criterion-a",
          name: "Criterion A",
          pillar_id: "pillar-a",
          position: 1,
          description: null,
          guidance: null,
        },
        {
          id: "criterion-b",
          name: "Criterion B",
          pillar_id: "pillar-b",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
      questions: [
        {
          id: "b1",
          prompt: "Pillar B question 1",
          criterion_id: "criterion-b",
          position: 1,
        },
        {
          id: "a2",
          prompt: "Pillar A question 2",
          criterion_id: "criterion-a",
          position: 2,
        },
        {
          id: "a1",
          prompt: "Pillar A question 1",
          criterion_id: "criterion-a",
          position: 1,
        },
        {
          id: "b2",
          prompt: "Pillar B question 2",
          criterion_id: "criterion-b",
          position: 2,
        },
        {
          id: "a3",
          prompt: "Pillar A question 3",
          criterion_id: "criterion-a",
          position: 3,
        },
      ],
    });

    expect(
      screen
        .getAllByTestId(/^edit-question-/)
        .map((node) => node.dataset.testid),
    ).toEqual([
      "edit-question-a1",
      "edit-question-a2",
      "edit-question-a3",
      "edit-question-b1",
      "edit-question-b2",
    ]);
    expect(
      screen.getByTestId("question-pillar-pillar-a"),
    ).not.toHaveTextContent("Pillar B question 1");
    expect(screen.getAllByLabelText("Question move up").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("heading", { name: "Draft version 1 — Editing" }),
    ).toBeInTheDocument();
  });

  it("previews the draft hierarchy and links publish back to review", () => {
    const pillars = [
      {
        id: "pillar-safety",
        name: "Safety & Quality",
        position: 1,
        section_id: "section-safety",
        description: null,
        guidance: null,
      },
      {
        id: "pillar-ci",
        name: "Continuous Improvement",
        position: 4,
        section_id: "section-ci",
        description: null,
        guidance: null,
      },
    ];
    const criteria = [
      {
        id: "criterion-standards",
        name: "Safety & Quality Standards",
        pillar_id: "pillar-safety",
        position: 1,
        description: null,
        guidance: null,
      },
      {
        id: "criterion-kaizen",
        name: "Structured Problem Solving & Kaizen",
        pillar_id: "pillar-ci",
        position: 1,
        description: null,
        guidance: null,
      },
    ];
    const kaizenPrompt =
      "How consistently are structured problem-solving and Kaizen methods used?";

    renderEditor({
      versionNumber: 4,
      initialAuthoringStep: "review",
      modelName: "CookieWorks",
      levels: [
        {
          id: "level-1",
          level_number: 1,
          name: "Reactive",
          color_token: "maturity-1",
          description: null,
          guidance: null,
        },
      ],
      pillars,
      criteria,
      questions: [
        {
          id: "question-kaizen",
          prompt: kaizenPrompt,
          criterion_id: "criterion-kaizen",
          position: 2,
        },
      ],
      activeVersion: {
        versionNumber: 3,
        pillars,
        criteria,
        questions: [
          {
            id: "question-kaizen-v3",
            prompt: kaizenPrompt,
            criterion_id: "criterion-standards",
            position: 2,
          },
        ],
      },
    });

    const preview = screen.getByTestId("draft-structure-preview");
    expect(
      within(preview).getByRole("heading", {
        name: "Draft version 4 preview",
      }),
    ).toBeInTheDocument();
    expect(
      within(preview).getByTestId("framework-preview-pillar-pillar-ci"),
    ).toHaveTextContent(kaizenPrompt);
    expect(
      within(preview).getByTestId("framework-preview-pillar-pillar-safety"),
    ).not.toHaveTextContent(kaizenPrompt);
    expect(within(preview).getByText("Site")).toBeInTheDocument();
    expect(within(preview).getByText("1. Reactive")).toBeInTheDocument();
    expect(screen.getByTestId("draft-change-summary")).toHaveTextContent(
      "Changes from Active v3",
    );
    expect(screen.getByTestId("draft-change-summary")).toHaveTextContent(
      "1 question moved",
    );
    expect(screen.getByTestId("draft-change-summary")).toHaveTextContent(
      "0 questions added",
    );
    expect(screen.getByTestId("draft-change-summary")).toHaveTextContent(
      "0 questions deleted",
    );

    fireEvent.click(screen.getByTestId("framework-step-publish"));
    expect(screen.getByTestId("framework-publish-summary")).toHaveTextContent(
      "Draft version",
    );
    expect(screen.getByTestId("framework-publish-summary")).toHaveTextContent(
      "4",
    );
    expect(
      screen.getByText(
        "Publishing makes Draft version 4 the active immutable version and archives the previously published version. Historical assessments remain pinned to their original version.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("review-structure"));
    expect(screen.getByTestId("draft-structure-preview")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("draft-structure-preview")).getByTestId(
        "framework-preview-pillar-pillar-safety",
      ),
    ).not.toHaveTextContent(kaizenPrompt);
  });
});
