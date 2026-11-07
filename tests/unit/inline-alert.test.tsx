import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, InlineAlert } from "@/components/ui/alert";

describe("InlineAlert", () => {
  it("renders tinted success, warning, error and info variants", () => {
    render(
      <div>
        <InlineAlert tone="success" testId="alert-success">
          Saved
        </InlineAlert>
        <InlineAlert tone="warning" testId="alert-warning">
          Review
        </InlineAlert>
        <InlineAlert tone="error" testId="alert-error">
          Failed
        </InlineAlert>
        <InlineAlert tone="info" testId="alert-info">
          Notice
        </InlineAlert>
      </div>,
    );

    expect(screen.getByTestId("alert-success")).toHaveClass("border-success/40");
    expect(screen.getByTestId("alert-warning")).toHaveClass("border-warning/40");
    expect(screen.getByTestId("alert-error")).toHaveClass("border-destructive/40");
    expect(screen.getByTestId("alert-info")).toHaveClass("border-information/40");
  });

  it("exposes alert role on Alert component", () => {
    const { unmount } = render(<Alert variant="destructive">Critical</Alert>);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    unmount();
  });
});
