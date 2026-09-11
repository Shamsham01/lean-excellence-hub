import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrganisationalUnitSelect } from "@/components/organisation/organisational-unit-select";

afterEach(() => {
  cleanup();
});

describe("OrganisationalUnitSelect", () => {
  it("renders site-local names without verbose site prefixes", () => {
    render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "bodmin-packing", name: "Packing" },
          { id: "bodmin-baking", name: "Baking" },
        ]}
        value="bodmin-packing"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByTestId("organisational-unit-select")).toBeVisible();
    expect(screen.getByRole("option", { name: "Packing" })).toHaveValue(
      "bodmin-packing",
    );
    expect(
      screen.queryByRole("option", { name: /Bodmin Cookie Factory ›/ }),
    ).not.toBeInTheDocument();
  });

  it("refreshes candidates when the active site options change", () => {
    const { rerender } = render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "bodmin-packing", name: "Packing" },
          { id: "bodmin-ops", name: "Operations" },
        ]}
        value="bodmin-packing"
        onChange={() => undefined}
      />,
    );

    const select = screen.getByTestId("organisational-unit-select");
    expect(
      select.querySelectorAll("option[value='bodmin-packing']"),
    ).toHaveLength(1);
    expect(select).toHaveValue("bodmin-packing");

    rerender(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "exeter-packing", name: "Packing" },
          { id: "exeter-ops", name: "Operations" },
        ]}
        value="exeter-packing"
        onChange={() => undefined}
      />,
    );

    const refreshed = screen.getByTestId("organisational-unit-select");
    expect(
      refreshed.querySelectorAll("option[value='exeter-packing']"),
    ).toHaveLength(1);
    expect(
      refreshed.querySelectorAll("option[value='bodmin-packing']"),
    ).toHaveLength(0);
    expect(refreshed).toHaveValue("exeter-packing");
  });

  it("starts unselected with a placeholder instead of the first unit", () => {
    render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "bodmin-baking", name: "Baking" },
          { id: "bodmin-packing", name: "Packing" },
        ]}
        value=""
        onChange={() => undefined}
        required
      />,
    );

    const select = screen.getByTestId("organisational-unit-select");
    expect(select).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Select organisational unit…" }),
    ).toHaveValue("");
    expect(select).not.toHaveValue("bodmin-baking");
  });

  it("clears an invalid value instead of substituting the first option", async () => {
    const onChange = vi.fn();
    render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "exeter-packing", name: "Packing" },
          { id: "exeter-ops", name: "Operations" },
        ]}
        value="bodmin-packing"
        onChange={onChange}
        required
      />,
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("");
    });
    expect(onChange).not.toHaveBeenCalledWith("exeter-packing");
    expect(onChange).not.toHaveBeenCalledWith("exeter-ops");
  });

  it("auto-selects only when a single candidate exists and the value is empty", async () => {
    const onChange = vi.fn();
    render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[{ id: "bodmin-packing", name: "Packing" }]}
        value=""
        onChange={onChange}
        required
      />,
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("bodmin-packing");
    });
  });

  it("preserves a valid saved value and shows a visible failure when it is missing", () => {
    const { rerender } = render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "bodmin-packing", name: "Packing" },
          { id: "bodmin-baking", name: "Baking" },
        ]}
        defaultValue="bodmin-packing"
        preferredValue="bodmin-packing"
        required
      />,
    );

    expect(screen.getByTestId("organisational-unit-select")).toHaveValue(
      "bodmin-packing",
    );
    expect(
      screen.queryByTestId("organisational-unit-select-unavailable"),
    ).not.toBeInTheDocument();

    rerender(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[
          { id: "exeter-packing", name: "Packing" },
          { id: "exeter-baking", name: "Baking" },
        ]}
        defaultValue=""
        preferredValue="bodmin-packing"
        required
      />,
    );

    expect(screen.getByTestId("organisational-unit-select")).toHaveValue("");
    expect(
      screen.getByTestId("organisational-unit-select-unavailable"),
    ).toHaveTextContent(
      "The previously selected organisational unit is not available in the active site. Choose a unit.",
    );
  });

  it("asks for an active site instead of mixing sites", () => {
    render(
      <OrganisationalUnitSelect
        label="Organisation unit"
        options={[]}
        value=""
        onChange={() => undefined}
        requiresSiteSelection
      />,
    );

    expect(screen.getByTestId("site-context-required")).toHaveTextContent(
      "Select an active site in the sidebar before choosing an organisational unit.",
    );
  });
});
