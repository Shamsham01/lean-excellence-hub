import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState, type FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useReportFormDialogPending } from "@/components/ui/report-form-dialog-pending";

function GuardedDialogForm({
  onSubmit,
}: {
  onSubmit: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useReportFormDialogPending(submitting);

  return (
    <form
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
          await onSubmit();
        } catch (submitError) {
          setError(
            submitError instanceof Error
              ? submitError.message
              : String(submitError),
          );
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <label htmlFor="title">Title</label>
      <input id="title" name="title" data-testid="title-input" />
      {error ? (
        <p role="alert" data-testid="form-error">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={submitting} data-testid="form-submit">
        Save
      </button>
    </form>
  );
}

function GuardedDialogHarness({
  onSubmit,
}: {
  onSubmit: () => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Test dialog"
      testId="guarded-dialog"
      enableGuard
    >
      <GuardedDialogForm onSubmit={onSubmit} />
    </ResponsiveFormDialog>
  );
}

describe("ResponsiveFormDialog guard pending stability", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width: 639px") ? false : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps typed draft and submit disabled while pending", async () => {
    let resolveSubmit: (() => void) | undefined;
    const submitStarted = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });

    render(
      <GuardedDialogHarness
        onSubmit={async () => {
          await submitStarted;
        }}
      />,
    );

    const input = screen.getByTestId("title-input");
    fireEvent.change(input, { target: { value: "Draft title" } });
    expect(input).toHaveValue("Draft title");

    fireEvent.click(screen.getByTestId("form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("form-submit")).toBeDisabled();
    });
    expect(input).toHaveValue("Draft title");

    resolveSubmit?.();
    await waitFor(() => {
      expect(screen.getByTestId("form-submit")).not.toBeDisabled();
    });
  });

  it("shows action errors and keeps draft when submit rejects", async () => {
    render(
      <GuardedDialogHarness
        onSubmit={async () => {
          throw new Error("Save failed");
        }}
      />,
    );

    const input = screen.getByTestId("title-input");
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByTestId("form-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("form-error")).toHaveTextContent("Save failed");
    });
    expect(input).toHaveValue("Keep this draft");
  });

  it("blocks dismiss while pending and confirms discard when draft exists", async () => {
    let resolveSubmit: (() => void) | undefined;
    const submitStarted = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });

    const { rerender } = render(
      <GuardedDialogHarness
        onSubmit={async () => {
          await submitStarted;
        }}
      />,
    );

    fireEvent.change(screen.getByTestId("title-input"), {
      target: { value: "Draft title" },
    });

    fireEvent.click(screen.getByTestId("form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("form-submit")).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByTestId("guarded-dialog")).toBeVisible();
    expect(
      screen.queryByTestId("form-dialog-discard-dialog"),
    ).not.toBeInTheDocument();

    resolveSubmit?.();
    await waitFor(() => {
      expect(screen.getByTestId("form-submit")).not.toBeDisabled();
    });

    fireEvent.change(screen.getByTestId("title-input"), {
      target: { value: "Draft title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.getByTestId("form-dialog-discard-dialog")).toBeVisible();
    });
  });
});
