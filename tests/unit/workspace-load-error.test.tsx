import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceLoadError } from "@/components/platform/workspace-load-error";

describe("WorkspaceLoadError", () => {
  afterEach(() => {
    cleanup();
  });

  it("warns that a previous action may already have been saved", () => {
    render(<WorkspaceLoadError onRetry={vi.fn()} />);

    expect(screen.getByTestId("workspace-load-error")).toHaveTextContent(
      "The page failed to reload. Your previous action may already have been saved. Reload before repeating it.",
    );
    expect(screen.getByTestId("workspace-load-error")).not.toHaveTextContent(
      "Your data was not changed",
    );
  });

  it("shows a safe reference id when provided", () => {
    render(<WorkspaceLoadError digest="abc123digest" onRetry={vi.fn()} />);

    expect(screen.getByTestId("error-digest")).toHaveTextContent(
      "Reference abc123digest",
    );
  });

  it("calls onRetry when Try again is clicked", () => {
    const onRetry = vi.fn();
    render(<WorkspaceLoadError onRetry={onRetry} />);
    const panel = screen.getByTestId("workspace-load-error");

    fireEvent.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
