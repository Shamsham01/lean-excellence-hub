import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveQuestionNote } from "@/app/(platform)/platform/maturity/actions";
import { QuestionCard } from "@/components/maturity/assessment-question-card";

vi.mock("@/app/(platform)/platform/maturity/actions", () => ({
  saveAssessmentAnswer: vi.fn(async () => ({ ok: true })),
  saveQuestionNote: vi.fn(),
}));

vi.mock("@/components/maturity/evidence-uploader", () => ({
  EvidenceUploader: () => <div data-testid="evidence-uploader" />,
}));

const saveNote = vi.mocked(saveQuestionNote);

describe("QuestionCard comments", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows retry feedback when question comment autosave fails", async () => {
    saveNote.mockResolvedValue({ error: "write failed" });

    render(
      <QuestionCard
        assessmentId="assess-1"
        criterionId="c1"
        question={{
          id: "q1",
          prompt: "Are roles clear?",
          question_type: "score",
          is_required: true,
          allows_not_applicable: false,
          help_text: null,
          contributes_to_score: true,
          position: 1,
        }}
        comment=""
        evidence={[]}
        levels={[{ level_number: 1, name: "Initial", guidance: null }]}
        canEdit
        trackSave={async (promise) => promise}
        onAnswerChange={vi.fn()}
        onCommentChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("question-comment"), {
      target: { value: "Shop-floor roles are posted." },
    });
    fireEvent.blur(screen.getByTestId("question-comment"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    });
    expect(screen.getByTestId("save-retry")).toBeVisible();
  });

  it("autosaves a question comment and keeps the typed value", async () => {
    saveNote.mockResolvedValue({ ok: true });

    render(
      <QuestionCard
        assessmentId="assess-1"
        criterionId="c1"
        question={{
          id: "q1",
          prompt: "Are roles clear?",
          question_type: "score",
          is_required: true,
          allows_not_applicable: false,
          help_text: null,
          contributes_to_score: true,
          position: 1,
        }}
        comment=""
        evidence={[]}
        levels={[{ level_number: 1, name: "Initial", guidance: null }]}
        canEdit
        trackSave={async (promise) => promise}
        onAnswerChange={vi.fn()}
        onCommentChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("question-comment"), {
      target: { value: "Roles are posted on the board." },
    });
    fireEvent.blur(screen.getByTestId("question-comment"));

    await waitFor(() => {
      expect(saveNote).toHaveBeenCalledWith(
        "assess-1",
        "q1",
        "Roles are posted on the board.",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-state-saved")).toHaveTextContent("Saved");
    });
    expect(screen.getByTestId("question-comment")).toHaveValue(
      "Roles are posted on the board.",
    );
  });
});
