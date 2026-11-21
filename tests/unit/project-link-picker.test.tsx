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

    fireEvent.click(screen.getByRole("combobox", { name: /link to project/i }));
    expect(
      screen.getByText("PRJ-001 · Walkway clearance · Active"),
    ).toBeInTheDocument();
  });

  it("keeps completed project links read-only", () => {
    render(
      <ProjectLinkField
        linked={{
          id: "proj-1",
          project_number: "PRJ-001",
          title: "Walkway clearance",
          status: "completed",
          href: "/platform/projects/proj-1",
          can_open: true,
        }}
        options={options}
        canEdit
        onLink={async () => ({})}
        onUnlink={async () => ({})}
      />,
    );

    expect(
      screen.queryByTestId("project-link-field-unlink"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("project-link-field-frozen")).toHaveTextContent(
      /read-only/i,
    );
  });
});

describe("action project picker", () => {
  const actionProjects = [
    "draft",
    "active",
    "on_hold",
    "completed",
    "cancelled",
    "submitted",
    "approved",
  ] as const;

  const projects = actionProjects.map((status) => ({
    ...options[0]!,
    id: status,
    project_number: `PRJ-${status}`,
    title: `Project ${status}`,
    status,
  }));

  it("offers only eligible projects with status badges and hints", () => {
    render(
      <ProjectLinkField
        forAction
        linked={null}
        options={projects}
        canEdit
        onLink={async () => ({})}
        onUnlink={async () => ({})}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: /link to project/i }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const label of ["Draft", "Active", "On hold"]) {
      expect(
        screen.getByText(label, { selector: "span.rounded-md" }),
      ).toBeVisible();
    }
    expect(screen.getByText("Project not yet approved")).toBeVisible();
    expect(
      screen.getByText("Project is on hold; due dates may slip"),
    ).toBeVisible();
  });

  it("shows the scoped empty state when only ineligible projects are present", () => {
    render(
      <ProjectLinkField
        forAction
        linked={null}
        options={projects.slice(3)}
        canEdit
        onLink={async () => ({})}
        onUnlink={async () => ({})}
      />,
    );

    expect(
      screen.getByText(
        "No draft, active or on-hold projects in your current scope",
      ),
    ).toBeVisible();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it.each(["completed", "cancelled"])(
    "keeps the existing %s link visible and read-only",
    (status) => {
      render(
        <ProjectLinkField
          forAction
          linked={{
            id: status,
            project_number: "PRJ-001",
            title: "Walkway clearance",
            status,
            href: `/platform/projects/${status}`,
            can_open: true,
          }}
          options={projects}
          canEdit
          onLink={async () => ({})}
          onUnlink={async () => ({})}
        />,
      );
      expect(
        screen.getByRole("link", { name: /walkway clearance/i }),
      ).toBeVisible();
      expect(screen.getByTestId("project-link-field-frozen")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull();
      expect(screen.queryByRole("combobox")).toBeNull();
    },
  );
});
