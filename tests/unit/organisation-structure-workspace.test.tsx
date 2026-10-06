import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrganisationUnitTree } from "@/components/organisation/organisation-unit-tree";
import { StructureWorkspace } from "@/components/organisation/structure-workspace";
import { buildOrganisationUnitTree } from "@/modules/organisation/unit-hierarchy";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 120,
      height: 32,
      top: 0,
      left: 0,
      bottom: 32,
      right: 120,
      toJSON: () => undefined,
    }) as DOMRect;
});

const units = [
  {
    id: "club",
    code: "the-club",
    name: "The Club",
    unit_type: "site",
    parent_unit_id: null,
    status: "active",
  },
  {
    id: "community",
    code: "community",
    name: "Community",
    unit_type: "department",
    parent_unit_id: "club",
    status: "active",
  },
  {
    id: "discord",
    code: "discord",
    name: "Discord",
    unit_type: "area",
    parent_unit_id: "community",
    status: "active",
  },
];

const tree = buildOrganisationUnitTree(units);
const summary = {
  activeUnits: 3,
  topLevelUnits: 1,
  archivedUnits: 1,
  childUnits: 2,
  maxDepth: 3,
};

const lifecycleActions = {
  onUpdate: vi.fn(),
  onMove: vi.fn(),
  onRetire: vi.fn(),
  onRestore: vi.fn(),
};

describe("OrganisationUnitTree", () => {
  it("shows name, type and code on hierarchy rows", () => {
    render(
      <OrganisationUnitTree
        nodes={tree}
        flatUnits={units}
        canManage
        canCreateRoot
        manageableUnitIds={units.map((unit) => unit.id)}
        lifecycleActions={lifecycleActions}
      />,
    );

    const community = screen.getByTestId("org-unit-node-community");
    expect(community).toHaveTextContent("Community");
    expect(community).toHaveTextContent("Department");
    expect(community).toHaveTextContent("community");
    expect(screen.getByTestId("org-unit-node-discord")).toHaveAttribute(
      "data-depth",
      "2",
    );
  });

  it("expands and collapses parents without losing nested data", () => {
    render(
      <OrganisationUnitTree nodes={tree} flatUnits={units} canManage={false} />,
    );

    expect(screen.getByTestId("org-unit-node-discord")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Collapse Community"));
    expect(
      screen.queryByTestId("org-unit-node-discord"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expand Community"));
    expect(screen.getByTestId("org-unit-node-discord")).toBeVisible();
  });

  it("hides management actions for read-only users", () => {
    render(
      <OrganisationUnitTree
        nodes={tree}
        flatUnits={units}
        canManage={false}
        manageableUnitIds={units.map((unit) => unit.id)}
        lifecycleActions={lifecycleActions}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add child/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();
  });
});

describe("StructureWorkspace", () => {
  it("opens Add child with the parent preselected and top-level add without a parent", async () => {
    const onCreate = vi.fn().mockResolvedValue({ ok: true });
    render(
      <StructureWorkspace
        tree={tree}
        flatUnits={units}
        activeUnits={units}
        retiredUnits={[
          {
            id: "old",
            code: "old",
            name: "Old unit",
            unit_type: "team",
            parent_unit_id: "club",
            status: "retired",
          },
        ]}
        summary={summary}
        canManage
        canCreateRoot
        canAddUnit
        manageableUnitIds={units.map((unit) => unit.id)}
        existingCodes={units.map((unit) => unit.code)}
        onCreate={onCreate}
        lifecycleActions={lifecycleActions}
      />,
    );

    fireEvent.click(screen.getByTestId("org-unit-add-child-club"));
    expect(screen.getByTestId("add-unit-drawer")).toBeVisible();
    expect(screen.getByTestId("unit-parent-select")).toHaveValue("club");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByTestId("add-unit-button"));
    expect(screen.getByTestId("unit-parent-select")).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Top level" }),
    ).toBeInTheDocument();
  });

  it("keeps Archive out of the primary row and exposes Move plus Archive in More", async () => {
    render(
      <StructureWorkspace
        tree={tree}
        flatUnits={units}
        activeUnits={units}
        retiredUnits={[]}
        summary={summary}
        canManage
        canCreateRoot
        canAddUnit
        manageableUnitIds={units.map((unit) => unit.id)}
        existingCodes={units.map((unit) => unit.code)}
        onCreate={vi.fn()}
        lifecycleActions={lifecycleActions}
      />,
    );

    const row = screen.getByTestId("org-unit-node-community");
    expect(row.querySelector('[data-testid="unit-archive-dialog"]')).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move" }),
    ).not.toBeInTheDocument();

    const more = screen.getByTestId("unit-more-menu-community");
    more.focus();
    fireEvent.keyDown(more, { key: "Enter", code: "Enter" });
    fireEvent.click(more);
    expect(
      await screen.findByTestId("unit-more-content-community"),
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Move" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeVisible();

    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    await waitFor(() => {
      expect(screen.getByTestId("unit-archive-dialog")).toBeVisible();
    });
  });

  it("collapses archived units behind a disclosure", () => {
    render(
      <StructureWorkspace
        tree={tree}
        flatUnits={units}
        activeUnits={units}
        retiredUnits={[
          {
            id: "old",
            code: "old",
            name: "Old unit",
            unit_type: "team",
            parent_unit_id: "club",
            status: "retired",
          },
        ]}
        summary={summary}
        canManage
        canCreateRoot
        canAddUnit
        manageableUnitIds={["old"]}
        existingCodes={["old"]}
        onCreate={vi.fn()}
        lifecycleActions={lifecycleActions}
      />,
    );

    const archived = screen.getByTestId("archived-units-section");
    expect(archived).not.toHaveAttribute("open");
    expect(screen.getByTestId("archived-units-toggle")).toHaveTextContent(
      "Archived units (1)",
    );
    fireEvent.click(screen.getByTestId("archived-units-toggle"));
    expect(screen.getByTestId("archived-unit-old")).toHaveTextContent(
      "Old unit",
    );
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeVisible();
  });

  it("shows subscribed site capacity from organisation billing state", () => {
    render(
      <StructureWorkspace
        tree={tree}
        flatUnits={units}
        activeUnits={units}
        retiredUnits={[]}
        summary={summary}
        canManage
        canCreateRoot
        canAddUnit
        manageableUnitIds={units.map((unit) => unit.id)}
        existingCodes={units.map((unit) => unit.code)}
        onCreate={vi.fn()}
        siteCapacity={{
          activeSiteCount: 1,
          subscribedLimit: 1,
          remainingSlots: 0,
          enforced: true,
          canManageBilling: true,
        }}
        lifecycleActions={lifecycleActions}
      />,
    );

    expect(screen.getByTestId("site-capacity-summary")).toHaveTextContent(
      "Sites",
    );
    expect(screen.getByTestId("site-capacity-headline")).toHaveTextContent(
      "1 of 1 subscribed sites active",
    );
    expect(screen.getByTestId("site-capacity-remaining")).toHaveTextContent(
      "No additional site slots available",
    );
    expect(screen.getByTestId("site-capacity-summary-billing")).toHaveAttribute(
      "href",
      "/platform/settings/billing",
    );
  });
});
