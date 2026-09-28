import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
        1,
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
        1,
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
});
