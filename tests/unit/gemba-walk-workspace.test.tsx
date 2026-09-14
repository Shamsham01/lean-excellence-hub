import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeGembaWalk,
  createGembaObservation,
  saveGembaWalkAnswer,
} from "@/app/(platform)/platform/gemba/actions";
import {
  ANSWER_SAVE_ERROR_MESSAGE,
  COMPLETE_WALK_SAVE_ERROR_MESSAGE,
} from "@/components/gemba/walk-answer-state";
import {
  DIRTY_OBSERVATION_COMPLETE_MESSAGE,
  GembaWalkWorkspace,
} from "@/components/gemba/walk-workspace";
import { gembaWalkPromptStorageKey } from "@/modules/operational/gemba-walk-prompt";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/gemba/actions", () => ({
  saveGembaWalkAnswer: vi.fn(),
  completeGembaWalk: vi.fn(),
  initiateGembaEvidenceUpload: vi.fn(),
  confirmGembaEvidenceUpload: vi.fn(),
  linkGembaEvidence: vi.fn(),
  createGembaObservation: vi.fn(),
  updateGembaObservation: vi.fn(),
  deleteGembaObservation: vi.fn(),
  deleteGembaObservations: vi.fn(),
}));

const saveAnswer = vi.mocked(saveGembaWalkAnswer);
const completeWalk = vi.mocked(completeGembaWalk);
const createObservation = vi.mocked(createGembaObservation);

const FIRST_ID = "q-first";
const SECOND_ID = "q-second";

type Question = {
  id: string;
  prompt: string;
  question_type: string;
  help_text: string | null;
};

function question(id: string, prompt: string): Question {
  return {
    id,
    prompt,
    question_type: "long_text",
    help_text: null,
  };
}

function sections(questions: Question[]) {
  return [
    {
      id: "operations-floor",
      title: "Operations floor",
      questions,
    },
  ];
}

function renderWorkspace({
  questions = [
    question(FIRST_ID, "What did you observe on the operations floor?"),
    question(SECOND_ID, "What help does the team need?"),
  ],
  answers = {},
  evidence = [],
  observations = [],
  canEdit = true,
  canComplete = false,
  onComplete,
  initialPromptId,
}: {
  questions?: Question[];
  answers?: Record<string, { text_value?: string | null }>;
  evidence?: Array<{
    id: string;
    filename: string;
    mime_type: string;
    byte_size: number;
    question_id?: string | null;
  }>;
  observations?: Array<{
    id: string;
    observation_text: string;
    observation_type: string;
  }>;
  canEdit?: boolean;
  canComplete?: boolean;
  onComplete?: typeof completeGembaWalk;
  initialPromptId?: string | null;
} = {}) {
  return render(
    <GembaWalkWorkspace
      walkId="walk-1"
      status="in_progress"
      sections={sections(questions)}
      answers={answers}
      evidence={evidence}
      observations={observations}
      canEdit={canEdit}
      canComplete={canComplete}
      {...(initialPromptId !== undefined ? { initialPromptId } : {})}
      {...(onComplete ? { onComplete } : {})}
    />,
  );
}

function confirmCompleteWalk() {
  fireEvent.click(screen.getByTestId("gemba-complete-walk"));
  fireEvent.click(screen.getByTestId("gemba-confirm-complete"));
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

beforeEach(() => {
  saveAnswer.mockReset();
  saveAnswer.mockResolvedValue({ ok: true });
  completeWalk.mockReset();
  completeWalk.mockResolvedValue({ ok: true });
  createObservation.mockReset();
  createObservation.mockResolvedValue({ observationId: "obs-new" });
});

describe("GembaWalkWorkspace answer state", () => {
  it("renders a Notes value from the server", () => {
    renderWorkspace({
      answers: { [FIRST_ID]: { text_value: "server notes" } },
    });

    expect(screen.getByLabelText("Notes")).toHaveValue("server notes");
  });

  it("updates the visible Notes field immediately while typing", () => {
    renderWorkspace({
      answers: { [FIRST_ID]: { text_value: "server notes" } },
    });

    const input = screen.getByLabelText("Notes");
    fireEvent.change(input, { target: { value: "typed locally" } });
    expect(input).toHaveValue("typed locally");
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("keeps a pasted or filled Notes value instead of snapping back to stale props", async () => {
    const view = renderWorkspace({
      answers: { [FIRST_ID]: { text_value: "server notes" } },
    });

    const input = screen.getByLabelText("Notes");
    fireEvent.paste(input, {
      clipboardData: { getData: () => "pasted floor notes" },
    });
    fireEvent.change(input, { target: { value: "pasted floor notes" } });
    expect(input).toHaveValue("pasted floor notes");

    view.rerender(
      <GembaWalkWorkspace
        walkId="walk-1"
        status="in_progress"
        sections={sections([
          question(FIRST_ID, "What did you observe on the operations floor?"),
          question(SECOND_ID, "What help does the team need?"),
        ])}
        answers={{ [FIRST_ID]: { text_value: "server notes" } }}
        evidence={[]}
        canEdit
      />,
    );

    expect(screen.getByLabelText("Notes")).toHaveValue("pasted floor notes");

    fireEvent.blur(screen.getByLabelText("Notes"));
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
        textValue: "pasted floor notes",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
  });

  it("keeps a dirty Notes value when moving to the next prompt and back", async () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "dirty local notes" },
    });
    expect(screen.getByLabelText("Notes")).toHaveValue("dirty local notes");
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "What help does the team need?" }),
      ).toBeVisible();
    });
    expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
      textValue: "dirty local notes",
    });

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Notes")).toHaveValue("dirty local notes");
    });
    expect(
      screen.getByRole("heading", {
        name: "What did you observe on the operations floor?",
      }),
    ).toBeVisible();
  });

  it("waits for persistence before Next can leave the current prompt", async () => {
    let resolveSave: (value: { ok: true }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "in-flight notes" },
    });
    fireEvent.blur(screen.getByLabelText("Notes"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(
      screen.getByRole("heading", {
        name: "What did you observe on the operations floor?",
      }),
    ).toBeVisible();

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
        screen.getByRole("heading", { name: "What help does the team need?" }),
      ).toBeVisible();
    });
  });

  it("waits for persistence before Previous can leave the current prompt", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "What help does the team need?" }),
      ).toBeVisible();
    });

    let resolveSave: (value: { ok: true }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "second prompt notes" },
    });
    fireEvent.blur(screen.getByLabelText("Notes"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(
      screen.getByRole("heading", { name: "What help does the team need?" }),
    ).toBeVisible();

    resolveSave({ ok: true });
    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "What did you observe on the operations floor?",
        }),
      ).toBeVisible();
    });
  });

  it("keeps the user on the current prompt and shows an error when save fails", async () => {
    saveAnswer.mockResolvedValue({ error: "RPC failed" });
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "unsaved notes" },
    });
    fireEvent.blur(screen.getByLabelText("Notes"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANSWER_SAVE_ERROR_MESSAGE,
      );
    });
    expect(screen.getByTestId("answer-save-status")).not.toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Notes")).toHaveValue("unsaved notes");
    expect(
      screen.getByRole("heading", {
        name: "What did you observe on the operations floor?",
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANSWER_SAVE_ERROR_MESSAGE,
      );
    });
    expect(
      screen.getByRole("heading", {
        name: "What did you observe on the operations floor?",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "What help does the team need?" }),
    ).not.toBeInTheDocument();
  });

  it("retries a failed save and then shows confirmed Saved state", async () => {
    saveAnswer.mockResolvedValue({ error: "RPC failed" });
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "retry notes" },
    });
    fireEvent.blur(screen.getByLabelText("Notes"));

    await waitFor(() => {
      expect(screen.getByTestId("answer-save-retry")).toBeVisible();
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    saveAnswer.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByTestId("answer-save-retry"));

    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(screen.getByLabelText("Notes")).toHaveValue("retry notes");
    expect(saveAnswer).toHaveBeenLastCalledWith("walk-1", FIRST_ID, {
      textValue: "retry notes",
    });
  });

  it("shows Saved only after the latest intended value is confirmed", async () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "confirmed notes" },
    });
    fireEvent.blur(screen.getByLabelText("Notes"));

    await waitFor(() => {
      expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
        "Saved",
      );
    });
    expect(screen.getByLabelText("Notes")).toHaveValue("confirmed notes");
  });

  it("does not let an older in-flight save replace newer Notes intent", async () => {
    const resolvers: Array<(value: { ok: true }) => void> = [];
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    renderWorkspace();
    const input = screen.getByLabelText("Notes");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
        textValue: "A",
      });
    });

    fireEvent.change(input, { target: { value: "B" } });
    expect(input).toHaveValue("B");
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      "Saving…",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    resolvers[0]!({ ok: true });
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
        textValue: "B",
      });
    });
    expect(input).toHaveValue("B");
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
    expect(input).toHaveValue("B");
    expect(saveAnswer.mock.calls.map((call) => call[2])).toEqual([
      { textValue: "A" },
      { textValue: "B" },
    ]);
  });

  it("flushes the latest dirty Notes value before Complete walk", async () => {
    let resolveSave: (value: { ok: true }) => void = () => undefined;
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "final walk notes" },
    });
    confirmCompleteWalk();

    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
        textValue: "final walk notes",
      });
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("gemba-confirm-complete")).toHaveTextContent(
      "Completing…",
    );

    resolveSave({ ok: true });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("walk-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not complete the walk when an answer save fails", async () => {
    saveAnswer.mockResolvedValue({ error: "RPC failed" });
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "blocked notes" },
    });
    fireEvent.blur(screen.getByLabelText("Notes"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANSWER_SAVE_ERROR_MESSAGE,
      );
    });

    confirmCompleteWalk();

    await waitFor(() => {
      expect(screen.getByTestId("gemba-complete-error")).toHaveTextContent(
        COMPLETE_WALK_SAVE_ERROR_MESSAGE,
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

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "drain failure" },
    });
    confirmCompleteWalk();
    expect(onComplete).not.toHaveBeenCalled();

    resolveSave({ error: "RPC failed" });
    await waitFor(() => {
      expect(screen.getByTestId("gemba-complete-error")).toHaveTextContent(
        COMPLETE_WALK_SAVE_ERROR_MESSAGE,
      );
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("answer-save-status")).toHaveTextContent(
      ANSWER_SAVE_ERROR_MESSAGE,
    );
  });

  it("waits for a newer in-flight Notes value before Complete", async () => {
    const resolvers: Array<(value: { ok: true }) => void> = [];
    saveAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    const input = screen.getByLabelText("Notes");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
        textValue: "A",
      });
    });

    fireEvent.change(input, { target: { value: "B" } });
    confirmCompleteWalk();
    expect(onComplete).not.toHaveBeenCalled();
    expect(input).toHaveValue("B");

    resolvers[0]!({ ok: true });
    await waitFor(() => {
      expect(saveAnswer).toHaveBeenCalledWith("walk-1", FIRST_ID, {
        textValue: "B",
      });
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(input).toHaveValue("B");

    resolvers[1]!({ ok: true });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("walk-1");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(saveAnswer.mock.calls.map((call) => call[2])).toEqual([
      { textValue: "A" },
      { textValue: "B" },
    ]);
  });

  it("keeps evidence filtered to the current prompt", () => {
    renderWorkspace({
      evidence: [
        {
          id: "ev-1",
          filename: "floor-photo.jpg",
          mime_type: "image/jpeg",
          byte_size: 2048,
          question_id: FIRST_ID,
        },
        {
          id: "ev-2",
          filename: "other-prompt.png",
          mime_type: "image/png",
          byte_size: 1024,
          question_id: SECOND_ID,
        },
      ],
    });

    expect(screen.getByTestId("evidence-uploader")).toBeVisible();
    expect(screen.getByText("floor-photo.jpg")).toBeVisible();
    expect(screen.queryByText("other-prompt.png")).not.toBeInTheDocument();
  });

  it("shows a friendly walk status instead of the raw enum", () => {
    renderWorkspace();
    expect(screen.getByTestId("gemba-walk-status")).toHaveTextContent(
      "In progress",
    );
    expect(screen.queryByText("in_progress")).not.toBeInTheDocument();
  });

  it("disables Next on the final prompt while keeping Complete walk available", async () => {
    renderWorkspace({
      canComplete: true,
      questions: [
        question("q1", "Prompt one"),
        question("q2", "Prompt two"),
        question("q3", "Prompt three"),
        question("q4", "Prompt four"),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Prompt two" })).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Prompt three" }),
      ).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Prompt four" }),
      ).toBeVisible();
    });

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByTestId("gemba-complete-walk")).toBeEnabled();
  });

  it("restores the current prompt after remount from session state", async () => {
    const view = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "What help does the team need?" }),
      ).toBeVisible();
    });
    expect(sessionStorage.getItem(gembaWalkPromptStorageKey("walk-1"))).toBe(
      SECOND_ID,
    );

    view.unmount();
    renderWorkspace();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "What help does the team need?" }),
      ).toBeVisible();
    });
  });

  it("falls back to the first prompt when stored identity is invalid", async () => {
    sessionStorage.setItem(gembaWalkPromptStorageKey("walk-1"), "missing-id");
    renderWorkspace();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "What did you observe on the operations floor?",
        }),
      ).toBeVisible();
    });
  });

  it("blocks completion while an observation editor is dirty", async () => {
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(
      screen.getByTestId("gemba-observation-type-improvement_opportunity"),
    );
    fireEvent.change(screen.getByTestId("gemba-observation-text"), {
      target: { value: "Unsaved floor issue" },
    });
    fireEvent.click(screen.getByTestId("gemba-complete-walk"));

    await waitFor(() => {
      expect(screen.getByTestId("gemba-complete-error")).toHaveTextContent(
        DIRTY_OBSERVATION_COMPLETE_MESSAGE,
      );
    });
    expect(
      screen.queryByTestId("gemba-confirm-complete"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("gemba-observation-text")).toHaveValue(
      "Unsaved floor issue",
    );
    expect(onComplete).not.toHaveBeenCalled();
    expect(createObservation).not.toHaveBeenCalled();
  });

  it("passes summary notes through the complete action", async () => {
    const onComplete = vi.fn().mockResolvedValue({ ok: true });
    renderWorkspace({ canComplete: true, onComplete });

    fireEvent.click(screen.getByTestId("gemba-complete-walk"));
    fireEvent.change(screen.getByTestId("gemba-summary-notes"), {
      target: { value: "Line is stable after the standard work refresh." },
    });
    fireEvent.click(screen.getByTestId("gemba-confirm-complete"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        "walk-1",
        "Line is stable after the standard work refresh.",
      );
    });
  });

  it("does not expose observation edit controls when the walk cannot be edited", () => {
    renderWorkspace({
      canEdit: false,
      observations: [
        {
          id: "obs-1",
          observation_text: "Observation: positive practice",
          observation_type: "positive_practice",
        },
      ],
    });

    expect(screen.getByText("Positive practice")).toBeVisible();
    expect(screen.getByText("Observation: positive practice")).toBeVisible();
    expect(
      screen.queryByTestId("gemba-observation-edit-obs-1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("gemba-observation-delete-obs-1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("gemba-capture-observation"),
    ).not.toBeInTheDocument();
  });
});
