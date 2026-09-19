import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestionDetail } from "@/components/suggestions/suggestion-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/suggestions/actions", () => ({
  createProjectFromSuggestion: vi.fn(),
  createSuggestionAction: vi.fn(),
  markSuggestionImplemented: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("suggestion project traceability", () => {
  it("renders a human-readable linked project and Open project navigation", () => {
    render(
      <SuggestionDetail
        detail={{
          id: "11111111-1111-4111-8111-111111111111",
          suggestion_number: "IDEA-2026-0001",
          title: "Pre-stage tooling",
          problem_or_opportunity: "Lost time",
          proposed_idea: "Trolley",
          status: "implementing",
          programme_name_snapshot: "Ideas",
          linked_actions: [],
          linked_projects: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              project_number: "PROJ-2026-0007",
              title: "Tooling pre-stage project",
              status: "draft",
              href: "/platform/projects/33333333-3333-4333-8333-333333333333",
              can_open: true,
            },
          ],
        }}
        comments={[]}
        statusHistory={[
          {
            from_status: "accepted",
            to_status: "implementing",
            changed_at: "2026-09-19T10:00:00.000Z",
            reason: null,
          },
        ]}
        evidence={[]}
        benefits={[]}
        canManage
        canCreateProject
        canUploadEvidence={false}
      />,
    );

    expect(
      screen.getByTestId("suggestion-activity-projects"),
    ).toHaveTextContent("PROJ-2026-0007");
    expect(
      screen.getByTestId("suggestion-activity-projects"),
    ).toHaveTextContent("Tooling pre-stage project");
    expect(
      screen.getByTestId(
        "suggestion-open-project-33333333-3333-4333-8333-333333333333",
      ),
    ).toHaveAttribute(
      "href",
      "/platform/projects/33333333-3333-4333-8333-333333333333",
    );
    expect(
      screen.getByTestId("suggestion-activity-projects").textContent,
    ).not.toMatch(/33333333-3333-4333-8333-333333333333/);
  });
});
