import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MarketingHome } from "@/components/marketing/home";
import { MarketingInteractiveExperience } from "@/components/marketing/interactive/experience";
import {
  demoReducer,
  initialDemoState,
} from "@/components/marketing/interactive/demo-store";

function renderExperience() {
  return render(<MarketingInteractiveExperience />);
}

async function submitSuggestion(
  title = "Move the changeover cleaning kit closer to the line.",
) {
  fireEvent.click(screen.getByTestId("leh-demo-start-suggestion"));
  const idea = screen.getByLabelText("Idea");
  fireEvent.change(idea, { target: { value: title } });
  fireEvent.click(screen.getByTestId("leh-demo-submit-idea"));
  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Idea submitted" }),
    ).toBeInTheDocument();
  });
}

describe("interactive LEH product experience", () => {
  afterEach(() => {
    cleanup();
  });

  it("places the workspace after the evidence-to-impact story and before platform", () => {
    render(<MarketingHome />);
    const tryLeh = document.getElementById("try-leh");
    const impact = document.getElementById("impact");
    const platform = document.getElementById("platform");
    expect(tryLeh).toBeTruthy();
    expect(impact).toBeTruthy();
    expect(platform).toBeTruthy();
    expect(
      Boolean(
        impact &&
        tryLeh &&
        platform &&
        impact.compareDocumentPosition(tryLeh) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        tryLeh &&
        platform &&
        tryLeh.compareDocumentPosition(platform) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("starts the suggestion scenario from the section CTA", () => {
    renderExperience();
    fireEvent.click(screen.getByTestId("leh-demo-start-suggestion"));
    expect(screen.getByTestId("leh-demo-suggestion-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Idea")).toHaveValue(
      "Move the changeover cleaning kit closer to the line.",
    );
  });

  it("completes the suggestion journey through manager review, action and lineage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderExperience();
    await submitSuggestion("Move kits to the line.");

    expect(screen.getByText("SUG-DEMO-001")).toBeInTheDocument();
    expect(screen.getByTestId("leh-demo-notification-count")).toHaveTextContent(
      "1",
    );

    fireEvent.click(screen.getByRole("button", { name: "View record" }));
    expect(
      screen.getByTestId("leh-demo-suggestion-record"),
    ).toBeInTheDocument();
    expect(screen.getByText("Submitted by")).toBeInTheDocument();
    expect(screen.getByText("Packing")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("leh-demo-notification-bell"));
    const panel = screen.getByTestId("leh-demo-notification-panel");
    expect(
      within(panel).getByText("New suggestion submitted"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "See manager review" }));
    expect(screen.getByTestId("leh-demo-perspective")).toHaveTextContent(
      "Viewing as: CI Manager",
    );
    fireEvent.click(screen.getByTestId("leh-demo-accept-suggestion"));
    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create action" }));
    fireEvent.click(screen.getByTestId("leh-demo-create-action"));
    await waitFor(() => {
      expect(screen.getByTestId("leh-demo-lineage")).toBeInTheDocument();
    });
    expect(screen.getAllByText("ACT-DEMO-001").length).toBeGreaterThan(0);
    expect(screen.getByText("converted to")).toBeInTheDocument();
    expect(screen.getByTestId("leh-demo-lite")).toBeInTheDocument();
    expect(screen.getByTestId("leh-demo-notification-count")).toHaveTextContent(
      /[3-4]/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("resets all simulator state", async () => {
    renderExperience();
    await submitSuggestion();
    fireEvent.click(screen.getByTestId("leh-demo-reset"));
    expect(
      screen.getByTestId("leh-demo-scenario-selector"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("leh-demo-notification-count"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Idea submitted" }),
    ).not.toBeInTheDocument();
  });

  it("runs a gemba finding into an owned action", async () => {
    renderExperience();
    fireEvent.click(screen.getByTestId("leh-demo-scenario-gemba"));
    fireEvent.click(screen.getByTestId("leh-demo-start-gemba"));
    const prompts = screen.getAllByRole("button", { name: "No" });
    fireEvent.click(prompts[0]!);
    fireEvent.click(prompts[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Record finding" }));
    expect(screen.getByTestId("leh-demo-gemba-finding")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create action" }));
    fireEvent.click(screen.getByTestId("leh-demo-gemba-create-action"));
    await waitFor(() => {
      expect(screen.getByTestId("leh-demo-lineage")).toBeInTheDocument();
    });
    expect(screen.getByText("Gemba finding")).toBeInTheDocument();
  });

  it("creates a standalone action and updates status", async () => {
    renderExperience();
    fireEvent.click(screen.getByTestId("leh-demo-scenario-action"));
    expect(
      screen.getByTestId("leh-demo-standalone-action"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("leh-demo-standalone-create"));
    await waitFor(() => {
      expect(screen.getByTestId("leh-demo-action-list")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Confirm line-side storage/));
    fireEvent.click(screen.getByTestId("leh-demo-action-status-in-progress"));
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("leh-demo-action-status-complete"));
    expect(screen.getAllByText("Complete").length).toBeGreaterThan(0);
  });

  it("progresses problem-solving stages without invoking a model", () => {
    renderExperience();
    fireEvent.click(screen.getByTestId("leh-demo-scenario-problem-solving"));
    expect(screen.getByTestId("leh-demo-problem-solving")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("leh-demo-problem-next"));
    expect(screen.getByTestId("leh-demo-leanai-prompt")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("leh-demo-problem-next"));
    expect(
      screen.getByText("Verify root cause before assigning countermeasure."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/authoritative/i)).not.toBeInTheDocument();
  });

  it("completes an illustrative maturity preview", () => {
    renderExperience();
    fireEvent.click(screen.getByTestId("leh-demo-scenario-maturity"));
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByTestId("leh-demo-maturity-3"));
    }
    expect(screen.getByTestId("leh-demo-maturity-result")).toBeInTheDocument();
    expect(screen.getByText("Current preview profile")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("leh-demo-maturity-result")).getByText(
        "Illustrative preview",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore the full maturity system" }),
    ).toHaveAttribute("href", "#maturity");
  });

  it("opens a notification and focuses the related record", async () => {
    renderExperience();
    await submitSuggestion();
    fireEvent.click(screen.getByTestId("leh-demo-notification-bell"));
    fireEvent.click(screen.getByText("New suggestion submitted"));
    expect(
      screen.getByTestId("leh-demo-suggestion-record"),
    ).toBeInTheDocument();
  });

  it("keeps future inbox and Microsoft paths disabled", async () => {
    renderExperience();
    await submitSuggestion();
    fireEvent.click(screen.getByRole("button", { name: "See manager review" }));
    fireEvent.click(screen.getByTestId("leh-demo-accept-suggestion"));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create action" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Create action" }));
    fireEvent.click(screen.getByTestId("leh-demo-create-action"));
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Send this experience to my inbox",
        }),
      ).toBeDisabled();
    });
    expect(
      screen.getByRole("button", { name: "Continue with Microsoft" }),
    ).toBeDisabled();
  });
});

describe("interactive experience source safety", () => {
  it("does not introduce hosted writes, email, oauth or uploads", () => {
    const files = [
      "src/components/marketing/interactive/demo-store.tsx",
      "src/components/marketing/interactive/experience.tsx",
      "src/components/marketing/interactive/suggestion-flow.tsx",
      "src/components/marketing/interactive/gemba-flow.tsx",
      "src/components/marketing/interactive/action-flow.tsx",
      "src/components/marketing/interactive/problem-solving-flow.tsx",
      "src/components/marketing/interactive/maturity-flow.tsx",
      "src/components/marketing/interactive/notifications.tsx",
      "src/components/marketing/interactive/workspace.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/supabase/i);
      expect(source).not.toMatch(/createClient|from\("suggestions"\)/);
      expect(source).not.toMatch(/make\.com|webhook/i);
      expect(source).not.toMatch(/type=["']file["']/);
      expect(source).not.toMatch(/openai|chat\.completions/i);
    }

    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".leh-demo-workspace");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("gsap");
    expect(css).not.toContain("three.js");
  });

  it("resets suggestion state in the reducer", () => {
    const submitted = demoReducer(initialDemoState, {
      type: "submit-suggestion",
      record: {
        id: "SUG-DEMO-001",
        title: "Example",
        area: "Packing",
        category: "Workplace organisation",
        opportunity: "Walks",
        benefit: "Less movement",
        evidenceName: null,
        status: "Submitted",
        submittedBy: "Visitor",
        createdLabel: "Just now",
        decision: null,
      },
    });
    expect(submitted.notifications).toHaveLength(1);
    const reset = demoReducer(submitted, { type: "reset" });
    expect(reset).toEqual(initialDemoState);
  });
});
