import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeFiveSAudit,
  saveFiveSAuditAnswer,
} from "@/app/(platform)/platform/5s/actions";
import {
  ANSWER_SAVE_ERROR_MESSAGE,
  COMPLETE_AUDIT_SAVE_ERROR_MESSAGE,
} from "@/components/five-s/audit-answer-state";
import { FiveSAuditWorkspace } from "@/components/five-s/audit-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/5s/actions", () => ({
  saveFiveSAuditAnswer: vi.fn(),
  completeFiveSAudit: vi.fn(),
  initiateFiveSEvidenceUpload: vi.fn(),
  confirmFiveSEvidenceUpload: vi.fn(),
  linkFiveSEvidence: vi.fn(),
}));

const saveAnswer = vi.mocked(saveFiveSAuditAnswer);
const completeAudit = vi.mocked(completeFiveSAudit);

const YES_NO_ID = "q-yes-no";
const SECOND_ID = "q-second";
const TEXT_ID = "q-text";
const NUMBER_ID = "q-number";
const NA_ID = "q-na";

type Question = {
  id: string;
  prompt: string;
  question_type: string;
  is_required: boolean;
  allows_not_applicable: boolean;
  help_text: string | null;
};

function question(
  id: string,
  prompt: string,
  questionType: string,
  allowsNotApplicable = false,
): Question {
  return {
    id,
    prompt,
    question_type: questionType,
    is_required: true,
    allows_not_applicable: allowsNotApplicable,
    help_text: null,
  };
}

function sections(questions: Question[], extra: Question[] = []) {
  return [
    {
      id: "sort",
      title: "Sort",
      questions,
    },
    ...(extra.length
      ? [{ id: "set-in-order", title: "Set in order", questions: extra }]
      : []),
  ];
}

function renderWorkspace({
  questions = [
    question(YES_NO_ID, "Is the area sorted?", "yes_no"),
    question(SECOND_ID, "Is the second check complete?", "yes_no"),
  ],
  extraQuestions = [],
  answers = {},
  evidence = [],
  canEdit = true,
  canComplete = false,
  onComplete,
  width,
}: {
  questions?: Question[];
  extraQuestions?: Question[];
  answers?: Record<
    string,
    {
      text_value?: string | null;
      number_value?: number | null;
      is_not_applicable?: boolean;
    }
  >;
  evidence?: Array<{
    id: string;
    filename: string;
    mime_type: string;
    byte_size: number;
    question_id?: string | null;
  }>;
  canEdit?: boolean;
  canComplete?: boolean;
  onComplete?: typeof completeFiveSAudit;
  width?: number;
} = {}) {
  const ui = (
    <FiveSAuditWorkspace
      auditId="audit-1"
      status="in_progress"
      sections={sections(questions, extraQuestions)}
      answers={answers}
      evidence={evidence}
      canEdit={canEdit}
      canComplete={canComplete}
      {...(onComplete ? { onComplete } : {})}
    />
  );

  return render(
    width ? (
      <div style={{ width }} data-testid="mobile-frame">
        {ui}
      </div>
    ) : (
      ui
    ),
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  saveAnswer.mockReset();
  saveAnswer.mockResolvedValue({ ok: true });
  completeAudit.mockReset();
  completeAudit.mockResolvedValue({ ok: true });
});

describe("FiveSAuditWorkspace answer state", () => {
  it("renders a Yes answer from the server as selected", () => {
    renderWorkspace({
      answers: { [YES_NO_ID]: { text_value: "yes" } },
    });

    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("leaves Yes and No unselected on a fresh unanswered question", () => {
    renderWorkspace();

    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects Yes immediately, persists the answer, and shows Saved", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(saveAnswer).toHaveBeenCalledWith("audit-1", YES_NO_ID, {
      textValue: "yes",
    });

    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
  });

  it("selects No after Yes and unselects Yes", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", YES_NO_ID, {
        textValue: "no",
      });
    });
  });

  it("surfaces a persistence failure without claiming Saved and keeps Retry", async () => {
    saveAnswer.mockResolvedValue({ error: "RPC failed" });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANSWER_SAVE_ERROR_MESSAGE,
      );
    });
    expect(screen.getByTestId("answer-save-status")).not.toHaveTextContent(
      "Saved",
    );
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("answer-save-retry")).toBeVisible();

    saveAnswer.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByTestId("answer-save-retry"));

    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
  });

  it("treats thrown save errors as failures", async () => {
    saveAnswer.mockRejectedValue(new Error("network down"));
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANSWER_SAVE_ERROR_MESSAGE,
      );
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("ignores a stale Yes response after a later No selection", async () => {
    let resolveYes: (value: { ok: true }) => void = () => undefined;
    let resolveNo: (value: { ok: true }) => void = () => undefined;
    saveAnswer
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveYes = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNo = resolve;
          }),
      );

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    resolveYes({ ok: true });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    resolveNo({ ok: true });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("rehydrates from a new server answers snapshot after refresh", async () => {
    const { rerender } = renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });

    rerender(
      <FiveSAuditWorkspace
        auditId="audit-1"
        status="in_progress"
        sections={sections([
          question(YES_NO_ID, "Is the area sorted?", "yes_no"),
          question(SECOND_ID, "Is the second check complete?", "yes_no"),
        ])}
        answers={{ [YES_NO_ID]: { text_value: "no" } }}
        evidence={[]}
        canEdit
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects N/A, clears incompatible values, and clears N/A when a real answer is chosen", async () => {
    renderWorkspace({
      questions: [
        question(NA_ID, "Optional housekeeping check", "yes_no", true),
      ],
      answers: {
        [NA_ID]: {
          text_value: "yes",
          number_value: 12,
          is_not_applicable: false,
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "N/A" }));

    expect(screen.getByRole("button", { name: "N/A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(saveAnswer).toHaveBeenCalledWith("audit-1", NA_ID, {
      isNotApplicable: true,
      textValue: null,
      numberValue: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByRole("button", { name: "N/A" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NA_ID, {
        textValue: "no",
      });
    });
  });

  it("keeps a text answer on local state instead of jumping back to stale props", async () => {
    const view = renderWorkspace({
      questions: [question(TEXT_ID, "Notes", "text")],
      answers: { [TEXT_ID]: { text_value: "server value" } },
    });

    const input = screen.getByLabelText("Response");
    expect(input).toHaveValue("server value");

    fireEvent.change(input, { target: { value: "typed locally" } });
    expect(input).toHaveValue("typed locally");

    view.rerender(
      <FiveSAuditWorkspace
        auditId="audit-1"
        status="in_progress"
        sections={sections([question(TEXT_ID, "Notes", "text")])}
        answers={{ [TEXT_ID]: { text_value: "server value" } }}
        evidence={[]}
        canEdit
      />,
    );

    expect(screen.getByLabelText("Response")).toHaveValue("typed locally");

    fireEvent.blur(screen.getByLabelText("Response"));
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "typed locally",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
  });

  it("keeps a numeric answer controlled locally and persists on blur", async () => {
    const view = renderWorkspace({
      questions: [question(NUMBER_ID, "Score the area", "score")],
      answers: { [NUMBER_ID]: { number_value: 1 } },
    });

    const input = screen.getByLabelText("Score");
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: "3" } });
    expect(input).toHaveValue(3);

    view.rerender(
      <FiveSAuditWorkspace
        auditId="audit-1"
        status="in_progress"
        sections={sections([question(NUMBER_ID, "Score the area", "score")])}
        answers={{ [NUMBER_ID]: { number_value: 1 } }}
        evidence={[]}
        canEdit
      />,
    );

    expect(screen.getByLabelText("Score")).toHaveValue(3);

    fireEvent.blur(screen.getByLabelText("Score"));
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NUMBER_ID, {
        numberValue: 3,
      });
    });
  });

  it("does not silently drop an in-flight Yes when moving to the next question", async () => {
    let resolveSave: (value: { ok: true }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    resolveSave({ ok: true });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    saveAnswer.mockResolvedValue({ ok: true });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Is the second check complete?" }),
      ).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  it("keeps the evidence uploader present and filtered to the current question", () => {
    renderWorkspace({
      evidence: [
        {
          id: "ev-1",
          filename: "packing-photo.jpg",
          mime_type: "image/jpeg",
          byte_size: 2048,
          question_id: YES_NO_ID,
        },
        {
          id: "ev-2",
          filename: "other-question.png",
          mime_type: "image/png",
          byte_size: 1024,
          question_id: SECOND_ID,
        },
      ],
    });

    expect(screen.getByTestId("evidence-uploader")).toBeVisible();
    expect(screen.getByTestId("evidence-file-input")).toBeEnabled();
    expect(screen.getByText("packing-photo.jpg")).toBeVisible();
    expect(screen.queryByText("other-question.png")).not.toBeInTheDocument();
  });

  it("selects Yes at mobile width without a refresh", async () => {
    renderWorkspace({ width: 390 });

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Yes" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass(
      "min-h-11",
    );
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(screen.getByTestId("evidence-uploader")).toBeVisible();
  });

  it("stops showing Saved as soon as a persisted text draft changes", async () => {
    renderWorkspace({
      questions: [question(TEXT_ID, "Notes", "text")],
      answers: { [TEXT_ID]: { text_value: "server value" } },
    });

    const input = screen.getByLabelText("Response");
    fireEvent.change(input, { target: { value: "first draft" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });

    fireEvent.change(input, { target: { value: "second draft" } });
    expect(input).toHaveValue("second draft");
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(saveAnswer).not.toHaveBeenCalledWith("audit-1", TEXT_ID, {
      textValue: "second draft",
    });

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "second draft",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
  });

  it("stops showing Saved as soon as a persisted number draft changes", async () => {
    renderWorkspace({
      questions: [question(NUMBER_ID, "Score the area", "score")],
      answers: { [NUMBER_ID]: { number_value: 1 } },
    });

    const input = screen.getByLabelText("Score");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });

    fireEvent.change(input, { target: { value: "4" } });
    expect(input).toHaveValue(4);
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(saveAnswer).not.toHaveBeenCalledWith("audit-1", NUMBER_ID, {
      numberValue: 4,
    });

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NUMBER_ID, {
        numberValue: 4,
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
  });

  it("flushes a final text edit before Complete and waits for persistence", async () => {
    let resolveSave: (value: { ok: true }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({
      questions: [question(TEXT_ID, "Notes", "text")],
      canComplete: true,
      onComplete,
    });

    fireEvent.change(screen.getByLabelText("Response"), {
      target: { value: "final notes" },
    });
    fireEvent.click(screen.getByTestId("five-s-complete-audit"));

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "final notes",
      });
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("five-s-complete-audit")).toHaveTextContent(
      "Completing…",
    );

    resolveSave({ ok: true });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("audit-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("waits for an in-flight Yes/No save before Complete", async () => {
    let resolveSave: (value: { ok: true }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByTestId("five-s-complete-audit"));

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", YES_NO_ID, {
        textValue: "yes",
      });
    });
    expect(onComplete).not.toHaveBeenCalled();

    resolveSave({ ok: true });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("audit-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("blocks Complete when a save fails and keeps the error visible", async () => {
    saveAnswer.mockResolvedValue({ error: "RPC failed" });
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANSWER_SAVE_ERROR_MESSAGE,
      );
    });

    fireEvent.click(screen.getByTestId("five-s-complete-audit"));

    await waitFor(() => {
      expect(screen.getByTestId("five-s-complete-error")).toHaveTextContent(
        COMPLETE_AUDIT_SAVE_ERROR_MESSAGE,
      );
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      ANSWER_SAVE_ERROR_MESSAGE,
    );
    expect(screen.getByTestId("answer-save-retry")).toBeVisible();
  });

  it("blocks Complete when an in-flight save fails during drain", async () => {
    let resolveSave: (value: { error: string }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByTestId("five-s-complete-audit"));
    expect(onComplete).not.toHaveBeenCalled();

    resolveSave({ error: "RPC failed" });
    await waitFor(() => {
      expect(screen.getByTestId("five-s-complete-error")).toHaveTextContent(
        COMPLETE_AUDIT_SAVE_ERROR_MESSAGE,
      );
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      ANSWER_SAVE_ERROR_MESSAGE,
    );
  });

  it("allows Complete after a successful answer-save drain", async () => {
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });

    fireEvent.click(screen.getByTestId("five-s-complete-audit"));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("audit-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("queues a revert to the confirmed text value behind an in-flight save", async () => {
    const resolvers: Array<(value: { ok: true }) => void> = [];
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    renderWorkspace({
      questions: [question(TEXT_ID, "Notes", "text")],
      answers: { [TEXT_ID]: { text_value: "A" } },
    });

    const input = screen.getByLabelText("Response");
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "B",
      });
    });
    expect(saveAnswer).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "A" } });
    expect(input).toHaveValue("A");
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(saveAnswer).toHaveBeenCalledTimes(1);

    resolvers[0]!({ ok: true });
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "A",
      });
    });
    expect(input).toHaveValue("A");
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    resolvers[1]!({ ok: true });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(input).toHaveValue("A");
    expect(saveAnswer).toHaveBeenCalledTimes(2);
  });

  it("queues a revert to the confirmed number value behind an in-flight save", async () => {
    const resolvers: Array<(value: { ok: true }) => void> = [];
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    renderWorkspace({
      questions: [question(NUMBER_ID, "Score the area", "score")],
      answers: { [NUMBER_ID]: { number_value: 1 } },
    });

    const input = screen.getByLabelText("Score");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NUMBER_ID, {
        numberValue: 2,
      });
    });
    expect(saveAnswer).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "1" } });
    expect(input).toHaveValue(1);
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(saveAnswer).toHaveBeenCalledTimes(1);

    resolvers[0]!({ ok: true });
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NUMBER_ID, {
        numberValue: 1,
      });
    });
    expect(input).toHaveValue(1);
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    resolvers[1]!({ ok: true });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(input).toHaveValue(1);
    expect(saveAnswer).toHaveBeenCalledTimes(2);
  });

  it("waits for a reverted in-flight text save before Complete", async () => {
    const resolvers: Array<(value: { ok: true }) => void> = [];
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });

    renderWorkspace({
      questions: [question(TEXT_ID, "Notes", "text")],
      answers: { [TEXT_ID]: { text_value: "A" } },
      canComplete: true,
      onComplete,
    });

    const input = screen.getByLabelText("Response");
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "B",
      });
    });

    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.click(screen.getByTestId("five-s-complete-audit"));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("five-s-complete-audit")).toHaveTextContent(
      "Completing…",
    );

    resolvers[0]!({ ok: true });
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", TEXT_ID, {
        textValue: "A",
      });
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(input).toHaveValue("A");

    resolvers[1]!({ ok: true });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("audit-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(saveAnswer.mock.calls.map((call) => call[2])).toEqual([
      { textValue: "B" },
      { textValue: "A" },
    ]);
  });

  it("waits for a reverted in-flight number save before Complete", async () => {
    const resolvers: Array<(value: { ok: true }) => void> = [];
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });

    renderWorkspace({
      questions: [question(NUMBER_ID, "Score the area", "score")],
      answers: { [NUMBER_ID]: { number_value: 1 } },
      canComplete: true,
      onComplete,
    });

    const input = screen.getByLabelText("Score");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NUMBER_ID, {
        numberValue: 2,
      });
    });

    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("five-s-complete-audit"));
    expect(onComplete).not.toHaveBeenCalled();

    resolvers[0]!({ ok: true });
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("audit-1", NUMBER_ID, {
        numberValue: 1,
      });
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(input).toHaveValue(1);

    resolvers[1]!({ ok: true });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("audit-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(saveAnswer.mock.calls.map((call) => call[2])).toEqual([
      { numberValue: 2 },
      { numberValue: 1 },
    ]);
  });
});
