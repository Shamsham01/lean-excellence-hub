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
    loadView.mockResolvedValue({ ok: true, view });
    loadConversation.mockResolvedValue({
      ok: true,
      sessionId: null,
      messages: [],
    });
    window.localStorage.clear();
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
    expect(screen.getByLabelText("Message LeanAI")).toBeDisabled();
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
    expect(screen.getByLabelText("Message LeanAI")).toBeDisabled();
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
      expect(screen.getByLabelText("Message LeanAI")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Message LeanAI"), {
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
});
