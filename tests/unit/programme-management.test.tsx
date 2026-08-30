import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProgrammeManagement } from "@/components/suggestions/programme-management";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/(platform)/platform/suggestions/actions", () => ({
  createSuggestionCategory: vi.fn(),
  createSuggestionProgrammeDraft: vi.fn(),
  createSuggestionProgrammeSuccessor: vi.fn(),
  deactivateSuggestionCategory: vi.fn(),
  deactivateSuggestionProgramme: vi.fn(),
  deleteSuggestionCategory: vi.fn(),
  deleteSuggestionProgrammeDraft: vi.fn(),
  publishSuggestionProgrammeVersion: vi.fn(),
  reactivateSuggestionCategory: vi.fn(),
  reactivateSuggestionProgramme: vi.fn(),
  updateSuggestionCategory: vi.fn(),
  updateSuggestionProgramme: vi.fn(),
  updateSuggestionProgrammeVersion: vi.fn(),
}));

const programmes = [
  {
    id: "prog-active",
    name: "Continuous Improvement Ideas",
    code: "CI",
    description: "Frontline improvement ideas from across the site",
    status: "active",
  },
  {
    id: "prog-deactivated",
    name: "Got an Idea",
    code: "GAI01",
    description: null,
    status: "deactivated",
  },
  {
    id: "prog-draft",
    name: "Future Ideas Programme",
    code: "FI",
    description: null,
    status: "active",
  },
];

const versions = [
  {
    id: "ver-published",
    programme_id: "prog-active",
    version_number: 1,
    lifecycle: "published",
    review_target_days: 14,
    submission_guidance: null,
    template_version_id: null,
  },
  {
    id: "ver-archived-1",
    programme_id: "prog-active",
    version_number: 1,
    lifecycle: "archived",
    review_target_days: null,
    submission_guidance: null,
    template_version_id: null,
  },
  {
    id: "ver-archived-2",
    programme_id: "prog-active",
    version_number: 2,
    lifecycle: "archived",
    review_target_days: null,
    submission_guidance: null,
    template_version_id: null,
  },
  {
    id: "ver-archived-3",
    programme_id: "prog-active",
    version_number: 3,
    lifecycle: "archived",
    review_target_days: null,
    submission_guidance: null,
    template_version_id: null,
  },
  {
    id: "ver-deactivated",
    programme_id: "prog-deactivated",
    version_number: 2,
    lifecycle: "published",
    review_target_days: null,
    submission_guidance: null,
    template_version_id: null,
  },
  {
    id: "ver-draft",
    programme_id: "prog-draft",
    version_number: 1,
    lifecycle: "draft",
    review_target_days: null,
    submission_guidance: null,
    template_version_id: null,
  },
];

const categories = [
  {
    id: "cat-active",
    name: "Safety",
    code: "SAFE",
    description: null,
    status: "active",
    display_order: 1,
  },
  {
    id: "cat-deactivated",
    name: "Old Category",
    code: "OLD",
    description: null,
    status: "deactivated",
    display_order: 2,
  },
];

function renderManagement() {
  return render(
    <ProgrammeManagement
      programmes={programmes}
      versions={versions}
      categories={categories}
      templateVersions={[]}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ProgrammeManagement administration UX", () => {
  it("renders two administration columns on desktop layout classes", () => {
    renderManagement();

    expect(screen.getByTestId("programme-management-columns")).toHaveClass(
      "lg:grid-cols-2",
    );
    expect(screen.getByTestId("programmes-section")).toBeInTheDocument();
    expect(screen.getByTestId("categories-section")).toBeInTheDocument();
  });

  it("keeps creation forms collapsed by default", () => {
    renderManagement();

    expect(
      screen.queryByTestId("programme-create-panel"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("category-create-panel"),
    ).not.toBeInTheDocument();
  });

  it("defaults programme and category filters to active", () => {
    renderManagement();

    expect(
      screen.getByLabelText("Status", { selector: "#programme-status-filter" }),
    ).toHaveValue("active");
    expect(
      screen.getByLabelText("Status", { selector: "#category-status-filter" }),
    ).toHaveValue("active");
    expect(
      screen.getByTestId("programme-card-prog-active"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("programme-card-prog-draft")).toBeInTheDocument();
    expect(
      screen.queryByTestId("programme-card-prog-deactivated"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("category-row-cat-active")).toBeInTheDocument();
    expect(
      screen.queryByTestId("category-row-cat-deactivated"),
    ).not.toBeInTheDocument();
  });

  it("shows deactivated programmes when deactivated filter is selected", () => {
    renderManagement();

    fireEvent.change(
      screen.getByLabelText("Status", { selector: "#programme-status-filter" }),
      { target: { value: "deactivated" } },
    );

    expect(
      screen.getByTestId("programme-card-prog-deactivated"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("programme-card-prog-active"),
    ).not.toBeInTheDocument();
  });

  it("shows all programmes when all filter is selected", () => {
    renderManagement();

    fireEvent.change(
      screen.getByLabelText("Status", { selector: "#programme-status-filter" }),
      { target: { value: "all" } },
    );

    expect(
      screen.getByTestId("programme-card-prog-active"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("programme-card-prog-deactivated"),
    ).toBeInTheDocument();
  });

  it("filters programmes by search query", () => {
    renderManagement();

    fireEvent.change(screen.getByLabelText("Search programmes"), {
      target: { value: "future" },
    });

    expect(screen.getByTestId("programme-card-prog-draft")).toBeInTheDocument();
    expect(
      screen.queryByTestId("programme-card-prog-active"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search programmes"), {
      target: { value: "gai01" },
    });
    fireEvent.change(
      screen.getByLabelText("Status", { selector: "#programme-status-filter" }),
      { target: { value: "all" } },
    );

    expect(
      screen.getByTestId("programme-card-prog-deactivated"),
    ).toBeInTheDocument();
  });

  it("shows draft programme status and draft actions", () => {
    renderManagement();

    expect(screen.getByTestId("programme-status-prog-draft")).toHaveTextContent(
      "Draft",
    );
    expect(
      screen.getByRole("button", { name: "Edit draft" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete draft" }),
    ).toBeInTheDocument();
  });

  it("collapses archived programme versions behind disclosure", () => {
    renderManagement();

    const disclosure = screen.getByTestId(
      "programme-archived-versions-prog-active",
    );
    expect(disclosure).toHaveTextContent("Previous versions (3)");
    expect(disclosure).not.toHaveAttribute("open");
  });

  it("expands programme and category create panels from action buttons", () => {
    renderManagement();

    fireEvent.click(screen.getByTestId("new-programme-button"));
    expect(screen.getByTestId("programme-create-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("new-category-button"));
    expect(screen.getByTestId("category-create-panel")).toBeInTheDocument();
  });

  it("shows deactivated categories only with deactivated filter", () => {
    renderManagement();

    fireEvent.change(
      screen.getByLabelText("Status", { selector: "#category-status-filter" }),
      { target: { value: "deactivated" } },
    );

    expect(
      screen.getByTestId("category-row-cat-deactivated"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("category-row-cat-active"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("keeps category edit actions available", () => {
    renderManagement();

    expect(
      screen.getAllByRole("button", { name: "Edit" }).length,
    ).toBeGreaterThan(0);
  });
});
