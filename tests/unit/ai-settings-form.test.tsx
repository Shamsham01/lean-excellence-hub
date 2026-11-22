import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import type { LeanAiCustomerInclusion } from "@/modules/billing/leanai-inclusion";

const inclusion: LeanAiCustomerInclusion = {
  state: "included",
  planLabel: "Professional",
  statement:
    "LeanAI is included with Professional. Included at no extra charge, subject to reasonable fair use. There is no AI overage invoice.",
  siteNote:
    "Usage is one shared organisation total. Subscribed site quantity scales the LEH subscription. It does not create a separate LeanAI limit for each site or each person.",
};

afterEach(() => {
  cleanup();
});

function renderForm(
  overrides: Partial<ComponentProps<typeof AiSettingsForm>> = {},
) {
  const onSave = vi.fn().mockResolvedValue({ ok: true });
  render(
    <AiSettingsForm
      inclusion={inclusion}
      initialEnabled={false}
      initialMonthlyTokenCeiling={null}
      initialWebSearchEnabled={false}
      usageSummary={null}
      onSave={onSave}
      {...overrides}
    />,
  );
  return { onSave };
}

describe("AiSettingsForm", () => {
  it("describes included access and public web research without a customer charge", () => {
    renderForm();

    expect(screen.getByTestId("ai-settings-web-search")).not.toBeChecked();
    expect(screen.getByTestId("ai-settings-inclusion")).toHaveTextContent(
      /Included at no extra charge, subject to reasonable fair use/i,
    );
    expect(
      screen.getByTestId("ai-settings-web-search-section"),
    ).toHaveTextContent(/does not add a charge to the subscription/i);
    expect(screen.queryByTestId("ai-settings-governance")).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /500,000|2,000,000|unlimited|margin|openai|\$|additional AI usage costs/i,
    );
  });

  it("saves web research without inventing a token ceiling", () => {
    const { onSave } = renderForm();

    fireEvent.click(screen.getByTestId("ai-settings-enabled"));
    fireEvent.click(screen.getByTestId("ai-settings-web-search"));
    fireEvent.click(screen.getByTestId("ai-settings-save"));

    expect(onSave).toHaveBeenCalledWith({
      aiEnabled: true,
      monthlyTokenCeiling: null,
      webSearchEnabled: true,
    });
  });

  it("keeps a previously configured ceiling when another setting is saved", () => {
    const { onSave } = renderForm({ initialMonthlyTokenCeiling: 100000 });

    expect(screen.getByTestId("ai-settings-governance")).toBeTruthy();
    expect(screen.getByTestId("ai-settings-ceiling-enabled")).toBeChecked();
    expect(screen.getByTestId("ai-settings-ceiling")).toHaveValue("100000");
    expect(screen.queryByTestId("ai-settings-ceiling-acknowledge")).toBeNull();

    fireEvent.click(screen.getByTestId("ai-settings-web-search"));
    fireEvent.click(screen.getByTestId("ai-settings-save"));

    expect(onSave).toHaveBeenCalledWith({
      aiEnabled: false,
      monthlyTokenCeiling: 100000,
      webSearchEnabled: true,
    });
  });

  it("requires acknowledgement before a new pause is saved", () => {
    const { onSave } = renderForm();

    fireEvent.click(screen.getByTestId("ai-settings-advanced-toggle"));
    fireEvent.click(screen.getByTestId("ai-settings-ceiling-enabled"));
    fireEvent.change(screen.getByTestId("ai-settings-ceiling"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByTestId("ai-settings-save"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/pauses new LeanAI/i);

    fireEvent.click(screen.getByTestId("ai-settings-ceiling-acknowledge"));
    fireEvent.click(screen.getByTestId("ai-settings-save"));

    expect(onSave).toHaveBeenCalledWith({
      aiEnabled: false,
      monthlyTokenCeiling: 1000,
      webSearchEnabled: false,
    });
  });

  it("clears an existing ceiling only when the administrator turns the pause off", () => {
    const { onSave } = renderForm({ initialMonthlyTokenCeiling: 100000 });

    fireEvent.click(screen.getByTestId("ai-settings-ceiling-enabled"));
    fireEvent.click(screen.getByTestId("ai-settings-save"));

    expect(onSave).toHaveBeenCalledWith({
      aiEnabled: false,
      monthlyTokenCeiling: null,
      webSearchEnabled: false,
    });
  });

  it("rejects a blank or non-whole ceiling before saving", () => {
    const { onSave } = renderForm();

    fireEvent.click(screen.getByTestId("ai-settings-advanced-toggle"));
    fireEvent.click(screen.getByTestId("ai-settings-ceiling-enabled"));
    fireEvent.click(screen.getByTestId("ai-settings-ceiling-acknowledge"));
    fireEvent.click(screen.getByTestId("ai-settings-save"));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("ai-settings-ceiling"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByTestId("ai-settings-save"));
    expect(onSave).not.toHaveBeenCalled();
  });
});
