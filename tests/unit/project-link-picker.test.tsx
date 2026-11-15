import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectLinkField } from "@/components/projects/project-link-field";
import type { ProjectSelectorOption } from "@/lib/projects/types";

const options: ProjectSelectorOption[] = [
  {
    id: "proj-1",
    project_number: "PRJ-001",
    title: "Walkway clearance",
    status: "active",
    unit_id: "unit-1",
  },
];

afterEach(() => {
  cleanup();
});

describe("ProjectLinkField", () => {
  it("shows linked project chip with status", () => {
    render(
      <ProjectLinkField
        linked={{
          id: "proj-1",
          project_number: "PRJ-001",
          title: "Walkway clearance",
          status: "active",
          href: "/platform/projects/proj-1",
          can_open: true,
        }}
        options={options}
        canEdit={false}
        onLink={async () => ({})}
        onUnlink={async () => ({})}
      />,
    );

    expect(screen.getByTestId("project-link-field-chip")).toHaveTextContent(
      "PRJ-001",
    );
    expect(screen.getByTestId("project-link-field-chip")).toHaveTextContent(
      "Active",
    );
    expect(screen.queryByTestId("project-link-picker")).not.toBeInTheDocument();
  });

  it("opens combobox when editable and unlinked", () => {
    render(
      <ProjectLinkField
        linked={null}
        options={options}
        canEdit
        onLink={async () => ({})}
        onUnlink={async () => ({})}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /link to project/i }));
    expect(
      screen.getByText("PRJ-001 · Walkway clearance · Active"),
    ).toBeInTheDocument();
  });
});
