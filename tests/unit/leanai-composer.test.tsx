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
    const send = screen.getByRole("button", { name: "Send", exact: true });
    expect(send).toBeVisible();
    expect(send).toBeDisabled();
    expect(send).toHaveTextContent("Send");
    fireEvent.keyDown(screen.getByLabelText("Ask LeanAI"), { key: "Enter" });
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

  it("preserves a full draft and allows a selected character to be replaced with a newline", () => {
    const value = "x".repeat(2000);
    const { onChange, onSubmit } = renderComposer({ value });
    const input = screen.getByLabelText<HTMLTextAreaElement>("Ask LeanAI");
    expect(input.maxLength).toBe(2000);
    input.setSelectionRange(0, 0);
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();

    input.setSelectionRange(0, 1);
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith(`\n${value.slice(1)}`);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([{ sending: true }, { disabled: true }])(
    "blocks form submission when %j",
    (overrides) => {
      const { onSubmit } = renderComposer(overrides);
      const input = screen.getByLabelText<HTMLTextAreaElement>("Ask LeanAI");
      expect(input).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Send", exact: true }),
      ).toBeDisabled();
      fireEvent.submit(input.form!);
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("lets touch users insert a line with Enter and submit with Send", () => {
    const { onSubmit } = renderComposer({ enterSends: false, value: "Hello" });
    expect(screen.getByText(/Enter adds a line/i)).toBeVisible();
    expect(
      fireEvent.keyDown(screen.getByLabelText("Ask LeanAI"), { key: "Enter" }),
    ).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
