import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LeanAiAssistantView } from "@/modules/leanai-context/assistant/types";

const view: LeanAiAssistantView = {
  organisationId: "org-a",
  membershipId: "mem-a",
  applicationAiAvailable: false,
  conversationAvailable: false,
  conversationUnavailableReason:
    "LeanAI conversation is turned off in this environment. Setup guidance below still works.",
  contextLabel: "Suggestions · Configuration",
  page: {
    module: "suggestions",
    workflow: "programme_configuration",
    route: "/platform/suggestions/programmes",
    pageTitle: "Suggestions configuration",
    authoringStep: null,
    entityValidated: false,
  },
  site: { mode: "all", activeSiteName: null },
  terminology: [
    {
      term: "Programme",
      meaning: "The campaign people submit ideas under.",
    },
  ],
  starterPrompts: ["What is a programme?"],
  summary: "No published Suggestion Programme exists yet.",
  remainingSetup: [
    {
      key: "suggestions",
      status: "not_started",
      reason: "No published Suggestion Programme exists yet.",
    },
  ],
  relevantState: { programmeCount: 0 },
  allowedActions: ["Create or edit programmes"],
  recommendation: {
    key: "suggestions_programme_setup",
    moduleKey: "suggestions",
    readinessKey: "suggestions",
    status: "not_started",
    priority: 50,
    title: "Set up a Suggestion Programme",
    body: "No published Suggestion Programme exists yet.",
    explain: "A programme is the campaign people submit under.",
    primaryCtaLabel: "Set it up",
    targetRoute: "/platform/suggestions/programmes",
    snoozeMinutes: 1440,
    organisationId: "org-a",
  },
};

const loadView = vi.fn();
const loadConversation = vi.fn();
const sendMessage = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/platform/suggestions/programmes",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/(platform)/platform/leanai/assistant/actions", () => ({
  loadLeanAiAssistantViewAction: (...args: unknown[]) => loadView(...args),
  loadLeanAiAssistantConversationAction: (...args: unknown[]) =>
    loadConversation(...args),
  sendLeanAiAssistantMessageAction: (...args: unknown[]) =>
    sendMessage(...args),
}));

vi.mock("@/app/(platform)/platform/leanai/coach/actions", () => ({
  explainLeanAiCoachIntervention: vi.fn(),
}));

vi.mock("@/app/(platform)/platform/leanai/context/actions", () => ({
  recordLeanAiSemanticEventAction: vi.fn().mockResolvedValue({ ok: true }),
}));

import { LeanAiAssistantChrome } from "@/components/leanai/leanai-assistant-chrome";
import { LeanAiAssistantProvider } from "@/components/leanai/leanai-assistant-provider";

describe("LeanAI assistant panel", () => {
  beforeEach(() => {
    loadView.mockReset();
    loadConversation.mockReset();
    sendMessage.mockReset();
    loadView.mockResolvedValue({ ok: true, view });
    loadConversation.mockResolvedValue({
      ok: true,
      sessionId: null,
      messages: [],
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/platform/suggestions/programmes");
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes("1024"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders context, deterministic guidance, and collapse/reopen without sending a chat", async () => {
    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("leanai-assistant-context-label"),
      ).toHaveTextContent("Suggestions · Configuration");
    });
    expect(screen.getByTestId("leanai-assistant-summary")).toHaveTextContent(
      "No published Suggestion Programme exists yet.",
    );
    expect(screen.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "suggestions_programme_setup",
    );
    expect(screen.getByTestId("leanai-assistant-ai-unavailable")).toBeVisible();
    expect(screen.getByLabelText("Ask LeanAI")).toBeDisabled();
    expect(sendMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("leanai-assistant-close"));
    expect(screen.getByTestId("leanai-assistant-rail")).toBeVisible();
    fireEvent.click(screen.getByTestId("leanai-assistant-open"));
    expect(screen.getByTestId("leanai-assistant-pane")).toBeVisible();
    expect(loadView).toHaveBeenCalledWith({
      pathname: "/platform/suggestions/programmes",
      search: "",
    });
  });

  it("opens an accessible mobile drawer without invoking chat", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    const openButton = screen.getByTestId("leanai-assistant-open");
    expect(openButton).toHaveAttribute("aria-label", "Open LeanAI assistant");
    expect(
      screen.queryByTestId("leanai-assistant-pane"),
    ).not.toBeInTheDocument();
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByTestId("leanai-assistant-pane")).toBeVisible();
    });
    expect(
      screen.getByRole("region", { name: "LeanAI assistant" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Ask LeanAI")).toBeDisabled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends a user message through the Coach assistant action when chat is allowed", async () => {
    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });
    sendMessage.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      envelope: { message: "A programme is the campaign people submit under." },
      modelClass: "standard",
    });

    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Ask LeanAI")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "What is a programme?" },
    });
    fireEvent.click(screen.getByTestId("leanai-assistant-send"));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/platform/suggestions/programmes",
          message: "What is a programme?",
        }),
      );
    });
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("What is a programme?");
    expect(
      await screen.findByTestId("leanai-assistant-assistant-message"),
    ).toHaveTextContent("campaign");
  });

  it("disables New while a message is sending", async () => {
    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });
    sendMessage.mockImplementation(() => new Promise(() => undefined));

    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Ask LeanAI")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "Conversation A question" },
    });
    fireEvent.click(screen.getByTestId("leanai-assistant-send"));
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("Conversation A question");
    expect(
      screen.getByTestId("leanai-assistant-new-conversation"),
    ).toBeDisabled();
  });

  it("starts a logical conversation boundary on New", async () => {
    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });
    sendMessage
      .mockResolvedValueOnce({
        ok: true,
        sessionId: "session-1",
        envelope: { message: "Conversation A answer." },
        modelClass: "standard",
      })
      .mockResolvedValueOnce({
        ok: true,
        sessionId: "session-1",
        envelope: { message: "Conversation B answer." },
        modelClass: "standard",
      });

    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Ask LeanAI")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "Conversation A question" },
    });
    fireEvent.click(screen.getByTestId("leanai-assistant-send"));
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("Conversation A question");
    expect(
      await screen.findByTestId("leanai-assistant-assistant-message"),
    ).toHaveTextContent("Conversation A answer.");
    expect(sendMessage.mock.calls[0]?.[0]).not.toHaveProperty(
      "conversationStartedAt",
    );

    fireEvent.click(screen.getByTestId("leanai-assistant-new-conversation"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("leanai-assistant-user-message"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText("Conversation A answer."),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "Conversation B question" },
    });
    fireEvent.click(screen.getByTestId("leanai-assistant-send"));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: "Conversation B question",
          conversationStartedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("Conversation B question");
    expect(
      screen.queryByText("Conversation A question"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByTestId("leanai-assistant-assistant-message"),
    ).toHaveTextContent("Conversation B answer.");
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        message: "Conversation B question",
        conversationStartedAt: window.sessionStorage.getItem(
          "leanai-assistant-cleared-at:org-a",
        ),
      }),
    );
  });

  it("fail-closes an invalid stored boundary instead of loading cross-boundary history", async () => {
    window.sessionStorage.setItem(
      "leanai-assistant-session:org-a",
      "session-1",
    );
    window.sessionStorage.setItem(
      "leanai-assistant-cleared-at:org-a",
      "not-an-iso-timestamp",
    );
    loadConversation.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      messages: [],
    });
    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });

    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    await waitFor(() => {
      expect(loadConversation).toHaveBeenCalledWith({
        sessionId: "session-1",
        conversationStartedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });
    expect(loadConversation.mock.calls[0]?.[0]?.conversationStartedAt).not.toBe(
      "not-an-iso-timestamp",
    );
    expect(
      window.sessionStorage.getItem("leanai-assistant-cleared-at:org-a"),
    ).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("reloads conversation B only when a stored boundary exists", async () => {
    window.sessionStorage.setItem(
      "leanai-assistant-session:org-a",
      "session-1",
    );
    window.sessionStorage.setItem(
      "leanai-assistant-cleared-at:org-a",
      "2026-10-02T12:00:00.000Z",
    );
    loadConversation.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      messages: [
        {
          id: "b-user",
          role: "user",
          content: "Conversation B after reload",
          createdAt: "2026-10-02T12:01:00.000Z",
          source: "deterministic",
        },
      ],
    });
    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });

    render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    await waitFor(() => {
      expect(loadConversation).toHaveBeenCalledWith({
        sessionId: "session-1",
        conversationStartedAt: "2026-10-02T12:00:00.000Z",
      });
    });
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("Conversation B after reload");
  });

  it("does not reuse another organisation's visible assistant messages", async () => {
    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });
    sendMessage.mockResolvedValue({
      ok: true,
      sessionId: "session-a",
      envelope: { message: "Org A answer." },
      modelClass: "standard",
    });

    const { rerender } = render(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Ask LeanAI")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "Org A question" },
    });
    fireEvent.click(screen.getByTestId("leanai-assistant-send"));
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("Org A question");

    loadView.mockResolvedValue({
      ok: true,
      view: {
        ...view,
        organisationId: "org-b",
        applicationAiAvailable: true,
        conversationAvailable: true,
        conversationUnavailableReason: null,
      },
    });
    rerender(
      <LeanAiAssistantProvider organisationId="org-b">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    await waitFor(() => {
      expect(screen.queryByText("Org A question")).not.toBeInTheDocument();
    });
  });
});
