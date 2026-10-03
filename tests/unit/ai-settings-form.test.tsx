import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AiSettingsForm } from "@/components/settings/ai-settings-form";

describe("AiSettingsForm web research", () => {
  it("defaults web search off and saves the authorised setting", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AiSettingsForm
        initialEnabled={false}
        initialMonthlyTokenCeiling={null}
        initialWebSearchEnabled={false}
        providerAvailable
        usageSummary={null}
        onSave={onSave}
      />,
    );

    expect(screen.getByTestId("ai-settings-web-search")).not.toBeChecked();
    expect(
      screen.getByTestId("ai-settings-web-search-section"),
    ).toHaveTextContent(/additional AI usage costs/i);

    fireEvent.click(screen.getByTestId("ai-settings-enabled"));
    fireEvent.click(screen.getByTestId("ai-settings-web-search"));
    fireEvent.click(screen.getByTestId("ai-settings-save"));

    expect(onSave).toHaveBeenCalledWith({
      aiEnabled: true,
      monthlyTokenCeiling: null,
      webSearchEnabled: true,
    });
  });
});
