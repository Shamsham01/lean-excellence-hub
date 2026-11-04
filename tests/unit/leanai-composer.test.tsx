import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  composerEnterAction,
  LeanAiComposer,
} from "@/components/leanai/leanai-composer";

afterEach(() => {
  cleanup();
});

function renderComposer(
  overrides: Partial<ComponentProps<typeof LeanAiComposer>> = {},
) {
  const onSubmit = vi.fn();
  const onChange = vi.fn();
  render(
    <LeanAiComposer
      value="Line one"
      onChange={onChange}
      onSubmit={onSubmit}
      disabled={false}
      sending={false}
      enterSends
      {...overrides}
    />,
  );
  return { onSubmit, onChange };
}

describe("composerEnterAction", () => {
  it("sends on Enter and keeps modifier Enter as a newline", () => {
    expect(composerEnterAction({ key: "Enter" }, true)).toBe("send");
    expect(composerEnterAction({ key: "Enter", ctrlKey: true }, true)).toBe(
      "newline",
    );
    expect(composerEnterAction({ key: "Enter", shiftKey: true }, true)).toBe(
      "newline",
    );
    expect(composerEnterAction({ key: "Enter", metaKey: true }, true)).toBe(
      "newline",
    );
    expect(composerEnterAction({ key: "a" }, true)).toBe("ignore");
  });

  it("does not send while an IME is composing", () => {
    expect(composerEnterAction({ key: "Enter", isComposing: true }, true)).toBe(
      "ignore",
    );
    expect(composerEnterAction({ key: "Enter", keyCode: 229 }, true)).toBe(
      "ignore",
    );
  });

  it("lets Enter insert a line when the keyboard is a touch keyboard", () => {
    expect(composerEnterAction({ key: "Enter" }, false)).toBe("newline");
  });
});

describe("LeanAiComposer", () => {
  it("sends on Enter and inserts a line for Ctrl, Shift, or Command Enter", () => {
    const { onSubmit, onChange } = renderComposer();
    const input = screen.getByLabelText("Ask LeanAI") as HTMLTextAreaElement;
    input.setSelectionRange(input.value.length, input.value.length);

    expect(fireEvent.keyDown(input, { key: "Enter", ctrlKey: true })).toBe(
      false,
    );
    expect(fireEvent.keyDown(input, { key: "Enter", metaKey: true })).toBe(
      false,
    );
    expect(fireEvent.keyDown(input, { key: "Enter", shiftKey: true })).toBe(
      true,
    );
    expect(onChange).toHaveBeenCalledWith("Line one\n");
    expect(onSubmit).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not send during IME composition", () => {
    const { onSubmit } = renderComposer();
    const input = screen.getByLabelText("Ask LeanAI");

    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps a visible Send button and refuses a blank draft", () => {
    const { onSubmit } = renderComposer({ value: "   " });
    const send = screen.getByTestId("leanai-assistant-send");
    expect(send).toBeVisible();
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("caps the draft at 2000 characters", () => {
    const { onChange } = renderComposer({ value: "" });
    fireEvent.change(screen.getByLabelText("Ask LeanAI"), {
      target: { value: "x".repeat(2001) },
    });
    expect(onChange).toHaveBeenCalledWith("x".repeat(2000));
  });

  it("shows the touch-keyboard hint when Enter does not send", () => {
    renderComposer({ enterSends: false, value: "Hello" });
    expect(screen.getByText(/Enter adds a line/i)).toBeVisible();
    expect(screen.getByTestId("leanai-assistant-send")).toBeEnabled();
  });
});
