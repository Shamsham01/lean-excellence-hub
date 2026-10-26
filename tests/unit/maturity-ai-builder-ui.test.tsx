import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BuildWithLeanAiCard } from "@/components/maturity/ai-builder/build-with-leanai-card";
import { MaturityBuilderWorkspace } from "@/components/maturity/ai-builder/maturity-builder-workspace";
import { deriveMaturityBuilderConversation } from "@/modules/maturity/ai-builder";
import type { MaturityBuilderConversationState } from "@/modules/maturity/ai-builder/types";

import {
  BUILDER_SESSION_ID,
  assistantPayload,
  proposalTurnMessages,
  sessionDetail,
  userMessage,
} from "../fixtures/maturity-ai-builder";

const push = vi.fn();
const refresh = vi.fn();
const sendAction = vi.fn();
const createAction = vi.fn();
const discardAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("@/app/(platform)/platform/maturity/builder/actions", () => ({
  sendMaturityBuilderMessageAction: (...args: unknown[]) => sendAction(...args),
  createMaturityDraftFromBuilderProposalAction: (...args: unknown[]) =>
    createAction(...args),
  discardMaturityBuilderConversationAction: (...args: unknown[]) =>
    discardAction(...args),
}));

function proposalState(): MaturityBuilderConversationState {
  const state = deriveMaturityBuilderConversation(
    sessionDetail(proposalTurnMessages()),
    { sessionId: BUILDER_SESSION_ID, conversationStartedAt: null },
  );
  if (!state) throw new Error("fixture");
  return state;
}

const SCOPE = "At what scope should assessments be carried out?";
const LEVELS = "How many maturity levels do you want?";
const PILLARS =
  "Should Engineering, Supply Chain and People be separate pillars?";

const DISCOVERY_QUESTIONS = [
  {
    question: SCOPE,
    suggestedAnswers: ["Site", "Department", "All three"],
  },
  {
    question: LEVELS,
    suggestedAnswers: [
      "Five levels: starting to continuously improving",
      "Four levels",
    ],
  },
  {
    question: PILLARS,
    suggestedAnswers: [
      "Separate pillars; no existing standards",
      "Use our existing standards",
    ],
  },
];

function discoveryState(
  questions: Array<{
    question: string;
    suggestedAnswers: string[];
  }> = DISCOVERY_QUESTIONS,
): MaturityBuilderConversationState {
  const state = deriveMaturityBuilderConversation(
    sessionDetail([
      userMessage(
        "a0000000-0000-4000-8000-000000000011",
        "Assess site standards",
        "2026-10-06T10:00:00.000000+00:00",
      ),
      {
        id: "a0000000-0000-4000-8000-000000000012",
        role: "assistant",
        content: "A couple of questions.",
        created_at: "2026-10-06T10:00:01.000000+00:00",
        structured_payload: assistantPayload({ questions }),
      },
    ]),
    { sessionId: BUILDER_SESSION_ID, conversationStartedAt: null },
  );
  if (!state) {
    throw new Error("fixture");
  }
  return state;
}

function renderWorkspace(
  conversation: MaturityBuilderConversationState | null,
  maxMessageChars = 2000,
) {
  return render(
    <MaturityBuilderWorkspace
      initialConversation={conversation}
      maxMessageChars={maxMessageChars}
      maxTurns={20}
    />,
  );
}

function answerButton(question: string, answer: string) {
  return within(screen.getByRole("group", { name: question })).getByRole(
    "button",
    { name: answer },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "44444444-4444-4444-8444-444444444444" },
    });
  }
});

afterEach(() => {
  cleanup();
});

describe("MaturityBuilderWorkspace", () => {
  it("starts with discovery and no proposal or create action", () => {
    renderWorkspace(null);
    expect(screen.getByTestId("maturity-builder-starters")).toBeInTheDocument();
    expect(
      screen.getByLabelText("What should your framework assess?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What LeanAI understands so far"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your proposal will appear here"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("maturity-builder-create-draft"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("maturity-builder-send")).toBeDisabled();
  });

  it("sends with Ctrl+Enter and shows the reply", async () => {
    const next = proposalState();
    next.turns = next.turns.slice(0, 2);
    next.currentProposal = null;
    sendAction.mockResolvedValue({
      ok: true,
      outcome: "ok",
      conversation: next,
    });
    renderWorkspace(null);

    fireEvent.click(
      screen.getByText(
        "Assess how consistently our sites apply our own operating standards",
      ),
    );
    const input = screen.getByTestId("maturity-builder-input");
    expect(input).toHaveValue(
      "Assess how consistently our sites apply our own operating standards",
    );
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1));
    expect(sendAction.mock.calls[0]?.[0]).toMatchObject({
      intent: "answer",
      message:
        "Assess how consistently our sites apply our own operating standards",
      focus: null,
    });
    expect(
      await screen.findByText("A couple of questions."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("maturity-builder-propose")).toBeInTheDocument();
  });

  it("labels the proposal as unsaved and shows exact counts", () => {
    renderWorkspace(proposalState());
    expect(
      screen.getByTestId("maturity-builder-proposal-badge"),
    ).toHaveTextContent("LeanAI proposal · not saved");
    expect(screen.getByTestId("maturity-builder-revision")).toHaveTextContent(
      "Revision 1",
    );
    const counts = within(
      screen.getByTestId("maturity-builder-proposal-counts"),
    );
    expect(counts.getByText("Levels").nextSibling).toHaveTextContent("4");
    expect(counts.getByText("Criteria").nextSibling).toHaveTextContent("5");
    expect(counts.getByText("Questions").nextSibling).toHaveTextContent("7");
    expect(screen.getByTestId("maturity-builder-create-draft")).toBeEnabled();
    expect(
      screen.getByTestId("maturity-builder-view-proposal"),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("refines one element with keyboard focus moved to the composer", async () => {
    const refined = proposalState();
    sendAction.mockResolvedValue({
      ok: true,
      outcome: "ok",
      conversation: refined,
    });
    renderWorkspace(proposalState());

    fireEvent.click(screen.getByTestId("maturity-builder-refine-pillar-1"));
    expect(
      screen.getByTestId("maturity-builder-refine-target"),
    ).toHaveTextContent("Refining pillar “Quality at Source”");
    const input = screen.getByLabelText(
      "Describe the change to pillar “Quality at Source”",
    );
    await waitFor(() => expect(input).toHaveFocus());
    expect(
      screen.getByTestId("maturity-builder-view-conversation"),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(
      screen.queryByTestId("maturity-builder-refine-target"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId("maturity-builder-refine-criterion-2-1"),
    );
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "rename it to Root cause" },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-send"));
    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1));
    expect(sendAction.mock.calls[0]?.[0]).toMatchObject({
      intent: "refine",
      message: "rename it to Root cause",
      focus: { kind: "criterion", pillarIndex: 2, criterionIndex: 1 },
    });
  });

  it("confirms before creating a draft and navigates to the editor", async () => {
    createAction.mockResolvedValue({
      ok: true,
      modelId: "model-1",
      redirectTo: "/platform/maturity/models/model-1?step=review",
    });
    renderWorkspace(proposalState());

    fireEvent.click(screen.getByTestId("maturity-builder-create-draft"));
    const dialog = await screen.findByTestId("maturity-builder-create-dialog");
    expect(dialog).toHaveTextContent(
      "4 levels, 3 pillars, 5 criteria and 7 scored questions",
    );
    expect(dialog).toHaveTextContent("Nothing is published");
    expect(createAction).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByTestId("maturity-builder-confirm-create"),
    );
    await waitFor(() =>
      expect(createAction).toHaveBeenCalledWith({
        proposalMessageId: "a0000000-0000-4000-8000-000000000004",
      }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/platform/maturity/models/model-1?step=review",
      ),
    );
  });

  it("shows create errors inside the dialog", async () => {
    createAction.mockResolvedValue({
      ok: false,
      reason: "stale_proposal",
      message: "This proposal is no longer the latest one.",
    });
    renderWorkspace(proposalState());
    fireEvent.click(screen.getByTestId("maturity-builder-create-draft"));
    fireEvent.click(
      await screen.findByTestId("maturity-builder-confirm-create"),
    );
    expect(
      await screen.findByTestId("maturity-builder-create-error"),
    ).toHaveTextContent("no longer the latest");
    expect(push).not.toHaveBeenCalled();
  });

  it("explains an invalid reply, keeps the proposal and offers retry", async () => {
    const messages = proposalTurnMessages();
    messages.push(
      {
        id: "a0000000-0000-4000-8000-000000000005",
        role: "user",
        content: "User request:\nMALFORMED_PROPOSAL_TEST",
        created_at: "2026-10-06T10:02:00.000000+00:00",
      },
      {
        id: "a0000000-0000-4000-8000-000000000006",
        role: "assistant",
        content: "Here is a proposal.",
        created_at: "2026-10-06T10:02:01.000000+00:00",
        structured_payload: assistantPayload({
          phase: "proposal",
          proposal_status: "invalid",
          proposal_issues: ["Maturity levels must contain between 3 and 5."],
        }),
      },
    );
    const state = deriveMaturityBuilderConversation(sessionDetail(messages), {
      sessionId: BUILDER_SESSION_ID,
      conversationStartedAt: null,
    });
    sendAction.mockResolvedValue({
      ok: true,
      outcome: "ok",
      conversation: state,
    });
    renderWorkspace(state);

    expect(
      screen.getByTestId("maturity-builder-invalid-proposal"),
    ).toHaveTextContent("The proposal below is unchanged");
    expect(screen.getByTestId("maturity-builder-revision")).toHaveTextContent(
      "Revision 1",
    );
    fireEvent.click(screen.getByTestId("maturity-builder-view-conversation"));
    fireEvent.click(screen.getByTestId("maturity-builder-retry"));
    await waitFor(() =>
      expect(sendAction.mock.calls[0]?.[0]).toMatchObject({ intent: "retry" }),
    );
  });

  it("retries the same submission after a provider failure", async () => {
    sendAction
      .mockResolvedValueOnce({
        ok: false,
        reason: "provider_error",
        message: "LeanAI could not reply just now. Nothing changed. Try again.",
        conversation: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        outcome: "ok",
        conversation: proposalState(),
      });
    renderWorkspace(null);
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "Our sites" },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-send"));
    expect(
      await screen.findByTestId("maturity-builder-error"),
    ).toHaveTextContent("Nothing changed");
    fireEvent.click(await screen.findByTestId("maturity-builder-retry"));
    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(2));
    expect(sendAction.mock.calls[1]?.[0]).toMatchObject({
      intent: "answer",
      message: "Our sites",
    });
    expect(sendAction.mock.calls[1]?.[0].idempotencyKey).toBeTruthy();
  });

  it("confirms before starting over", async () => {
    discardAction.mockResolvedValue({ ok: true });
    renderWorkspace(proposalState());
    fireEvent.click(screen.getByTestId("maturity-builder-discard"));
    const dialog = await screen.findByTestId("maturity-builder-discard-dialog");
    expect(dialog).toHaveTextContent("No framework has been created");
    fireEvent.click(
      within(dialog).getByTestId("maturity-builder-confirm-discard"),
    );
    await waitFor(() => expect(discardAction).toHaveBeenCalled());
    expect(
      await screen.findByTestId("maturity-builder-starters"),
    ).toBeInTheDocument();
  });
});

describe("guided maturity builder answers", () => {
  it("selects, replaces and clears one answer per question without filling the notes", () => {
    renderWorkspace(discoveryState());

    const site = answerButton(SCOPE, "Site");
    const department = answerButton(SCOPE, "Department");
    const allThree = answerButton(SCOPE, "All three");
    const levels = answerButton(
      LEVELS,
      "Five levels: starting to continuously improving",
    );
    expect(site).toHaveAttribute("aria-pressed", "false");
    expect(site).toHaveAttribute("tabindex", "0");
    expect(department).toHaveAttribute("tabindex", "-1");

    site.focus();
    fireEvent.keyDown(site, { key: "ArrowDown" });
    expect(department).toHaveFocus();
    fireEvent.click(department);
    expect(department).toHaveAttribute("aria-pressed", "true");
    expect(site).toHaveAttribute("aria-pressed", "false");
    expect(allThree).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(site);
    expect(site).toHaveAttribute("aria-pressed", "true");
    expect(department).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(levels);
    expect(levels).toHaveAttribute("aria-pressed", "true");
    expect(site).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByTestId("maturity-builder-selection-summary"),
    ).toHaveTextContent("2 of 3 answered");

    fireEvent.click(site);
    expect(site).toHaveAttribute("aria-pressed", "false");
    expect(levels).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("maturity-builder-input")).toHaveValue("");
    expect(
      screen.getByLabelText("Additional instructions (optional)"),
    ).toHaveValue("");
  });

  it("sends structured answers with optional notes and keeps questions independent", async () => {
    sendAction.mockResolvedValue({
      ok: true,
      outcome: "ok",
      conversation: discoveryState([
        {
          question: "Who will own the assessments?",
          suggestedAnswers: ["Site leaders"],
        },
      ]),
    });
    renderWorkspace(discoveryState());

    fireEvent.click(answerButton(SCOPE, "Site"));
    fireEvent.click(
      answerButton(LEVELS, "Five levels: starting to continuously improving"),
    );
    fireEvent.click(
      answerButton(PILLARS, "Separate pillars; no existing standards"),
    );
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "Keep the bakery wording." },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-send"));

    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1));
    expect(sendAction.mock.calls[0]?.[0]).toMatchObject({
      intent: "answer",
      focus: null,
      message: [
        `Question: ${SCOPE}`,
        "Answer: Site",
        "",
        `Question: ${LEVELS}`,
        "Answer: Five levels: starting to continuously improving",
        "",
        `Question: ${PILLARS}`,
        "Answer: Separate pillars; no existing standards",
        "",
        "Additional instructions:",
        "Keep the bakery wording.",
      ].join("\n"),
    });
    expect(
      await screen.findByRole("button", { name: "Site leaders" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Site" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("maturity-builder-input")).toHaveValue("");
  });

  it("sends a free-form reply on its own and includes selections in draft proposal", async () => {
    sendAction.mockResolvedValue({
      ok: true,
      outcome: "ok",
      conversation: discoveryState(),
    });
    renderWorkspace(discoveryState());

    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "We already use a four-level model." },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-send"));
    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1));
    expect(sendAction.mock.calls[0]?.[0]).toMatchObject({
      intent: "answer",
      message: "We already use a four-level model.",
    });
    expect(String(sendAction.mock.calls[0]?.[0].message)).not.toContain(
      "Question:",
    );
    await waitFor(() => {
      expect(screen.getByTestId("maturity-builder-input")).toHaveValue("");
      expect(screen.getByTestId("maturity-builder-send")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    });

    fireEvent.click(answerButton(SCOPE, "All three"));
    fireEvent.click(screen.getByTestId("maturity-builder-propose"));
    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(2));
    expect(sendAction.mock.calls[1]?.[0]).toMatchObject({
      intent: "propose",
      focus: null,
      message: `Question: ${SCOPE}\nAnswer: All three`,
    });
  });

  it("retries the original payload and clears unsent edited choices after success", async () => {
    const sameQuestions = discoveryState();
    sendAction
      .mockResolvedValueOnce({
        ok: false,
        reason: "timeout",
        message: "LeanAI took too long to reply. Nothing changed. Try again.",
        conversation: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        outcome: "ok",
        conversation: sameQuestions,
      });
    renderWorkspace(discoveryState());
    fireEvent.click(answerButton(SCOPE, "Site"));
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "Bakery lines." },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-send"));
    expect(
      await screen.findByTestId("maturity-builder-error"),
    ).toHaveTextContent("Try again");
    expect(answerButton(SCOPE, "Site")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("maturity-builder-input")).toHaveValue(
      "Bakery lines.",
    );

    fireEvent.click(answerButton(SCOPE, "Department"));
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "Changed after the failure." },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-retry"));
    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(2));
    expect(sendAction.mock.calls[1]?.[0]).toMatchObject({
      intent: "answer",
      message: sendAction.mock.calls[0]?.[0].message,
    });
    expect(sendAction.mock.calls[0]?.[0].message).toBe(
      `Question: ${SCOPE}\nAnswer: Site\n\nAdditional instructions:\nBakery lines.`,
    );
    expect(sendAction.mock.calls[1]?.[0].idempotencyKey).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("maturity-builder-input")).toHaveValue(""),
    );
    // The retry sent "Site", not the later edit to "Department".
    // Never leave the edited answer highlighted as if LeanAI accepted it.
    await waitFor(() => {
      expect(answerButton(SCOPE, "Department")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(answerButton(SCOPE, "Site")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  });

  it("blocks an over-long reply before the server action and preserves every answer", () => {
    renderWorkspace(discoveryState(), 40);
    fireEvent.click(answerButton(SCOPE, "Site"));
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "Extra detail that must not be cut off." },
    });
    expect(
      screen.getByTestId("maturity-builder-length-error"),
    ).toHaveTextContent("40 characters");
    expect(screen.getByTestId("maturity-builder-send")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("maturity-builder-composer"));
    expect(sendAction).not.toHaveBeenCalled();
    expect(answerButton(SCOPE, "Site")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("maturity-builder-input")).toHaveValue(
      "Extra detail that must not be cut off.",
    );
  });

  it("clears guided answers on start over", async () => {
    discardAction.mockResolvedValue({ ok: true });
    renderWorkspace(discoveryState());
    fireEvent.click(answerButton(SCOPE, "Site"));
    fireEvent.click(screen.getByTestId("maturity-builder-discard"));
    fireEvent.click(
      within(
        await screen.findByTestId("maturity-builder-discard-dialog"),
      ).getByTestId("maturity-builder-confirm-discard"),
    );
    expect(
      await screen.findByTestId("maturity-builder-starters"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("maturity-builder-questions"),
    ).not.toBeInTheDocument();
  });
});

describe("BuildWithLeanAiCard", () => {
  it("links to the builder when available", () => {
    render(
      <BuildWithLeanAiCard
        access={{
          canManage: true,
          available: true,
          reason: null,
          message: null,
        }}
        hasConversation={false}
      />,
    );
    expect(screen.getByTestId("maturity-build-with-leanai")).toHaveAttribute(
      "href",
      "/platform/maturity/builder",
    );
  });

  it("explains why the builder is unavailable without a link", () => {
    render(
      <BuildWithLeanAiCard
        access={{
          canManage: true,
          available: false,
          reason: "organisation_ai_disabled",
          message: "LeanAI is turned off for this organisation.",
        }}
        hasConversation={false}
      />,
    );
    expect(
      screen.queryByTestId("maturity-build-with-leanai"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("maturity-build-with-leanai-unavailable"),
    ).toHaveTextContent("turned off");
  });
});
