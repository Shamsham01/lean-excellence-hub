import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthoringSaveFeedback } from "@/components/authoring/authoring-save-feedback";

afterEach(() => {
  cleanup();
});

describe("AuthoringSaveFeedback", () => {
  it("renders a server flash message from savedKey", () => {
    render(<AuthoringSaveFeedback savedKey="applicability" />);

    expect(screen.getByTestId("authoring-save-feedback")).toHaveTextContent(
      "Applicable areas saved.",
    );
  });

  it("renders an inline client message when provided", () => {
    render(<AuthoringSaveFeedback message="Saved." />);

    expect(screen.getByTestId("authoring-save-feedback")).toHaveTextContent(
      "Saved.",
    );
  });

  it("renders nothing when no confirmation is available", () => {
    render(<AuthoringSaveFeedback />);

    expect(
      screen.queryByTestId("authoring-save-feedback"),
    ).not.toBeInTheDocument();
  });
});
