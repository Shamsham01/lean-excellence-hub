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

describe("suggestion action traceability", () => {
  it("renders a human-readable linked action and Open action navigation", () => {
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
          linked_actions: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              action_number: "ACT-2026-0004",
              title: "Create standard pre-stage trolley",
              status: "open",
              href: "/platform/actions/22222222-2222-4222-8222-222222222222",
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
        canCreateProject={false}
        canUploadEvidence={false}
      />,
    );

    expect(screen.getByTestId("suggestion-activity-actions")).toHaveTextContent(
      "ACT-2026-0004",
    );
    expect(screen.getByTestId("suggestion-activity-actions")).toHaveTextContent(
      "Create standard pre-stage trolley",
    );
    expect(
      screen.getByTestId(
        "suggestion-open-action-22222222-2222-4222-8222-222222222222",
      ),
    ).toHaveAttribute(
      "href",
      "/platform/actions/22222222-2222-4222-8222-222222222222",
    );
    expect(
      screen.getByTestId("suggestion-activity-actions").textContent,
    ).not.toMatch(/22222222-2222-4222-8222-222222222222/);
  });
});
