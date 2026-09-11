import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
