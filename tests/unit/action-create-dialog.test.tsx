import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionCreateDialog } from "@/components/actions/action-create-form";
import {
  createPlannerAction,
  loadActionCreateContext,
} from "@/app/(platform)/platform/actions/actions";

vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  createPlannerAction: vi.fn(),
  loadActionCreateContext: vi.fn(),
}));

const createPlannerActionMock = vi.mocked(createPlannerAction);
const loadActionCreateContextMock = vi.mocked(loadActionCreateContext);

beforeEach(() => {
  loadActionCreateContextMock.mockResolvedValue({
    labels: [],
    assignablePeople: [],
    canManageLabels: false,
  });
});

describe("ActionCreateDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens discard confirmation on Escape when the draft is dirty", () => {
    const onOpenChange = vi.fn();
    render(
      <ActionCreateDialog
        open
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "Draft title" } });
    const dialog = screen.getByTestId("actions-create-dialog");
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("actions-create-discard-dialog")).toBeVisible();
  });

  it("discards the draft when confirmation is accepted", () => {
    const onOpenChange = vi.fn();
    const view = render(
      <ActionCreateDialog
        open
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Temporary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByTestId("actions-create-discard-confirm"));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    view.rerender(
      <ActionCreateDialog
        open={false}
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    view.rerender(
      <ActionCreateDialog
        open
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("retains the draft when discard confirmation is dismissed", () => {
    const onOpenChange = vi.fn();
    render(
      <ActionCreateDialog
        open
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Keep me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByTestId("actions-create-dialog")).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("Keep me");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows a server error without closing the dialog", async () => {
    createPlannerActionMock.mockResolvedValue({ error: "Could not save" });
    render(
      <ActionCreateDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Fails" },
    });
    const dialog = screen.getByTestId("actions-create-dialog");
    fireEvent.submit(within(dialog).getByTestId("actions-create-form"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save"),
    );
    expect(screen.getByTestId("actions-create-dialog")).toBeVisible();
  });

  it("prevents duplicate submits while create is in flight", async () => {
    let release: () => void = () => undefined;
    const deferred = new Promise<{ id: string }>((resolve) => {
      release = () => resolve({ id: "action-1" });
    });
    createPlannerActionMock.mockImplementation(() => deferred);

    render(
      <ActionCreateDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Single submit" },
    });
    const dialog = screen.getByTestId("actions-create-dialog");
    const submit = within(dialog).getByTestId("actions-create-submit");
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(createPlannerActionMock).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() =>
      expect(createPlannerActionMock).toHaveBeenCalledTimes(1),
    );
  });
});
