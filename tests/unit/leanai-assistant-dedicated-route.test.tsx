import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LeanAiAssistantView } from "@/modules/leanai-context/assistant/types";
import { LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY } from "@/modules/leanai-context/assistant/constants";

const navigation = vi.hoisted(() => ({
  pathname: "/platform/maturity/models",
}));

const view: LeanAiAssistantView = {
  organisationId: "org-a",
  membershipId: "mem-a",
  organisation: { name: "Harbourfield Foods" },
  capabilities: { webSearchEnabled: false },
  applicationAiAvailable: true,
  conversationAvailable: true,
  conversationUnavailableReason: null,
  contextLabel: "Maturity · Frameworks",
  page: {
    module: "maturity",
    workflow: "maturity_models",
    route: "/platform/maturity/models",
    pageTitle: "Maturity frameworks",
    authoringStep: null,
    entityValidated: false,
  },
  site: { mode: "all", activeSiteName: null },
  terminology: [],
  starterPrompts: [],
  summary: "Frameworks can be drafted here.",
  remainingSetup: [],
  relevantState: {},
  allowedActions: [],
  recommendation: null,
};

const loadView = vi.fn();
const loadConversation = vi.fn();
const sendMessage = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
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

function renderAssistant() {
  return render(
    <LeanAiAssistantProvider organisationId="org-a">
      <LeanAiAssistantChrome />
    </LeanAiAssistantProvider>,
  );
}

describe("LeanAI assistant on the maturity builder route", () => {
  beforeEach(() => {
    navigation.pathname = "/platform/maturity/models";
    loadView.mockReset();
    loadConversation.mockReset();
    sendMessage.mockReset();
    loadView.mockResolvedValue({ ok: true, view });
    loadConversation.mockResolvedValue({
      ok: true,
      sessionId: null,
      messages: [],
    });
    sendMessage.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      envelope: { message: "Maturity is a picture of current practice." },
      modelClass: "standard",
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it("hides every global assistant surface on the builder and restores the open state", async () => {
    const rendered = renderAssistant();
    await waitFor(() => {
      expect(screen.getByTestId("leanai-assistant-desktop")).toBeVisible();
    });

    navigation.pathname = "/platform/maturity/builder";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );

    expect(
      screen.queryByTestId("leanai-assistant-desktop"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("leanai-assistant-rail"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("leanai-assistant-open"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("leanai-assistant-pane"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "LeanAI assistant" }),
    ).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem(LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY),
    ).not.toBe("0");

    navigation.pathname = "/platform/maturity/models";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    expect(screen.getByTestId("leanai-assistant-desktop")).toBeVisible();

    fireEvent.click(screen.getByTestId("leanai-assistant-close"));
    expect(screen.getByTestId("leanai-assistant-rail")).toBeVisible();
    expect(
      window.localStorage.getItem(LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY),
    ).toBe("0");

    navigation.pathname = "/platform/maturity/builder";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    expect(
      screen.queryByTestId("leanai-assistant-rail"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("leanai-assistant-open"),
    ).not.toBeInTheDocument();

    navigation.pathname = "/platform/maturity";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    expect(screen.getByTestId("leanai-assistant-rail")).toBeVisible();
    expect(
      screen.queryByTestId("leanai-assistant-desktop"),
    ).not.toBeInTheDocument();
  });

  it("keeps the global conversation while the builder hides the assistant", async () => {
    const rendered = renderAssistant();
    await waitFor(() => {
      expect(screen.getByLabelText("Ask LeanAI")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "What does maturity mean here?" },
    });
    fireEvent.click(screen.getByTestId("leanai-assistant-send"));
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("What does maturity mean here?");

    navigation.pathname = "/platform/maturity/builder";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    expect(
      screen.queryByTestId("leanai-assistant-user-message"),
    ).not.toBeInTheDocument();

    navigation.pathname = "/platform/maturity/models";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    expect(
      await screen.findByTestId("leanai-assistant-user-message"),
    ).toHaveTextContent("What does maturity mean here?");
    expect(
      screen.getByTestId("leanai-assistant-assistant-message"),
    ).toHaveTextContent("picture of current practice");
  });

  it("hides the mobile trigger on the builder without opening a sheet", async () => {
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
    const rendered = renderAssistant();
    expect(screen.getByTestId("leanai-assistant-open")).toHaveAttribute(
      "aria-label",
      "Open LeanAI assistant",
    );

    navigation.pathname = "/platform/maturity/builder";
    rendered.rerender(
      <LeanAiAssistantProvider organisationId="org-a">
        <LeanAiAssistantChrome />
      </LeanAiAssistantProvider>,
    );
    expect(
      screen.queryByTestId("leanai-assistant-open"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
