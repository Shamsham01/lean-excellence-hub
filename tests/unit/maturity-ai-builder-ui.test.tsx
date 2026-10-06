import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function renderWorkspace(
  conversation: MaturityBuilderConversationState | null,
) {
  return render(
    <MaturityBuilderWorkspace
      initialConversation={conversation}
      maxMessageChars={2000}
      maxTurns={20}
    />,
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
    expect(screen.getByText("What LeanAI understands so far")).toBeInTheDocument();
    expect(screen.getByText("Your proposal will appear here")).toBeInTheDocument();
    expect(
      screen.queryByTestId("maturity-builder-create-draft"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("maturity-builder-send")).toBeDisabled();
  });

  it("sends with Ctrl+Enter and shows the reply", async () => {
    const next = proposalState();
    next.turns = next.turns.slice(0, 2);
    next.currentProposal = null;
    sendAction.mockResolvedValue({ ok: true, outcome: "ok", conversation: next });
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
    expect(await screen.findByText("A couple of questions.")).toBeInTheDocument();
    expect(screen.getByTestId("maturity-builder-propose")).toBeInTheDocument();
  });

  it("labels the proposal as unsaved and shows exact counts", () => {
    renderWorkspace(proposalState());
    expect(screen.getByTestId("maturity-builder-proposal-badge")).toHaveTextContent(
      "LeanAI proposal · not saved",
    );
    expect(screen.getByTestId("maturity-builder-revision")).toHaveTextContent(
      "Revision 1",
    );
    const counts = within(screen.getByTestId("maturity-builder-proposal-counts"));
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
    sendAction.mockResolvedValue({ ok: true, outcome: "ok", conversation: refined });
    renderWorkspace(proposalState());

    fireEvent.click(screen.getByTestId("maturity-builder-refine-pillar-1"));
    expect(screen.getByTestId("maturity-builder-refine-target")).toHaveTextContent(
      "Refining pillar “Quality at Source”",
    );
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

    fireEvent.click(screen.getByTestId("maturity-builder-refine-criterion-2-1"));
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
    expect(dialog).toHaveTextContent("4 levels, 3 pillars, 5 criteria and 7 scored questions");
    expect(dialog).toHaveTextContent("Nothing is published");
    expect(createAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByTestId("maturity-builder-confirm-create"));
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
    fireEvent.click(await screen.findByTestId("maturity-builder-confirm-create"));
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
    sendAction.mockResolvedValue({ ok: true, outcome: "ok", conversation: state });
    renderWorkspace(state);

    expect(screen.getByTestId("maturity-builder-invalid-proposal")).toHaveTextContent(
      "The proposal below is unchanged",
    );
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
      .mockResolvedValueOnce({ ok: true, outcome: "ok", conversation: proposalState() });
    renderWorkspace(null);
    fireEvent.change(screen.getByTestId("maturity-builder-input"), {
      target: { value: "Our sites" },
    });
    fireEvent.click(screen.getByTestId("maturity-builder-send"));
    expect(await screen.findByTestId("maturity-builder-error")).toHaveTextContent(
      "Nothing changed",
    );
    fireEvent.click(screen.getByTestId("maturity-builder-retry"));
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
    fireEvent.click(within(dialog).getByTestId("maturity-builder-confirm-discard"));
    await waitFor(() => expect(discardAction).toHaveBeenCalled());
    expect(await screen.findByTestId("maturity-builder-starters")).toBeInTheDocument();
  });
});

describe("BuildWithLeanAiCard", () => {
  it("links to the builder when available", () => {
    render(
      <BuildWithLeanAiCard
        access={{ canManage: true, available: true, reason: null, message: null }}
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
