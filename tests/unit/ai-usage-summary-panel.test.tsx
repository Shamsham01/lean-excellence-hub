import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AiUsageSummaryPanel } from "@/components/settings/ai-usage-summary-panel";

afterEach(() => {
  cleanup();
});

describe("AiUsageSummaryPanel", () => {
  it("renders a readable summary instead of raw JSON", () => {
    render(
      <AiUsageSummaryPanel
        usageSummary={{
          runs_this_month: 2,
          input_tokens: 1000,
          output_tokens: 500,
          cached_input_tokens: 0,
          reasoning_tokens: 0,
          tool_calls: 1,
          provider_distribution: [
            { provider: "openai", model: "gpt-4.1-mini", run_count: 2 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("ai-usage-summary")).toBeTruthy();
    expect(screen.getByTestId("ai-usage-runs").textContent).toBe("2");
    expect(screen.getByTestId("ai-usage-total-tokens").textContent).toBe(
      "1,500",
    );
    expect(screen.getByTestId("ai-usage-provider-table")).toBeTruthy();
    expect(screen.getByText("gpt-4.1-mini")).toBeTruthy();
  });

  it("shows total tokens as input plus output only", () => {
    render(
      <AiUsageSummaryPanel
        usageSummary={{
          runs_this_month: 1,
          input_tokens: 100,
          output_tokens: 200,
          cached_input_tokens: 50,
          reasoning_tokens: 25,
          tool_calls: 1,
          provider_distribution: [],
        }}
      />,
    );

    expect(screen.getByTestId("ai-usage-total-tokens").textContent).toBe("300");
    expect(screen.getByTestId("ai-usage-cached-input-tokens").textContent).toBe(
      "50",
    );
    expect(screen.getByTestId("ai-usage-reasoning-tokens").textContent).toBe(
      "25",
    );
  });

  it("shows an empty-state message for valid zero usage", () => {
    render(
      <AiUsageSummaryPanel
        usageSummary={{
          runs_this_month: 0,
          input_tokens: 0,
          output_tokens: 0,
          cached_input_tokens: 0,
          reasoning_tokens: 0,
          tool_calls: 0,
          provider_distribution: [],
        }}
      />,
    );

    expect(screen.getByTestId("ai-usage-empty").textContent).toContain(
      "No Lean AI usage recorded this month yet.",
    );
  });

  it("shows unavailable UI for malformed payloads instead of zero usage", () => {
    render(<AiUsageSummaryPanel usageSummary={{}} />);

    expect(screen.getByTestId("ai-usage-empty").textContent).toBe(
      "Usage summary is unavailable.",
    );
    expect(
      screen.queryByText("No Lean AI usage recorded this month yet."),
    ).toBeNull();
  });

  it("shows a clear load error instead of an empty summary", () => {
    render(
      <AiUsageSummaryPanel
        usageSummary={null}
        usageLoadError="You are not authorised to view Lean AI usage for this organisation."
      />,
    );

    expect(screen.getByTestId("ai-usage-load-error").textContent).toBe(
      "You are not authorised to view Lean AI usage for this organisation.",
    );
    expect(screen.queryByTestId("ai-usage-empty")).toBeNull();
  });
});
