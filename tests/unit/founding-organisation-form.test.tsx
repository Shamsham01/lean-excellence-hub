import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FoundingOrganisationForm } from "@/components/onboarding/founding-organisation-form";

describe("FoundingOrganisationForm", () => {
  it("keeps organisation and first site as separate fields", () => {
    render(<FoundingOrganisationForm action={vi.fn()} />);
    expect(screen.getByLabelText("Organisation name")).toBeInTheDocument();
    expect(screen.getByLabelText("First site")).toBeInTheDocument();
    expect(
      screen.getByText(
        /What company, business or group does this site belong to/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Which site are you setting up first/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("multi-site-intent")).toBeInTheDocument();
  });

  it("guides identical names when the founder said the site belongs to a wider group", () => {
    render(<FoundingOrganisationForm action={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Organisation name"), {
      target: { value: "Plymouth Factory" },
    });
    fireEvent.change(screen.getByLabelText("First site"), {
      target: { value: "Plymouth Factory" },
    });
    fireEvent.click(
      screen.getByLabelText("Yes, part of a wider multi-site organisation"),
    );
    expect(screen.getByTestId("identical-name-guidance")).toHaveTextContent(
      "Acme Foods Ltd",
    );
  });

  it("does not block identical names for a single-site company", () => {
    render(<FoundingOrganisationForm action={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Organisation name"), {
      target: { value: "Plymouth Factory" },
    });
    fireEvent.change(screen.getByLabelText("First site"), {
      target: { value: "Plymouth Factory" },
    });
    fireEvent.click(
      screen.getByLabelText("No, this is a single-site organisation"),
    );
    expect(
      screen.queryByTestId("identical-name-guidance"),
    ).not.toBeInTheDocument();
  });
});
