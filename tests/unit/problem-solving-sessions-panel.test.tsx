import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionsPanel } from "@/components/problem-solving/sessions-panel";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/problem-solving/actions", () => ({
  startProblemSolvingSession: vi.fn(),
  addSessionEntry: vi.fn(),
  completeProblemSolvingSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function detailFixture(
  overrides: Partial<ProblemSolvingCaseDetail> = {},
): ProblemSolvingCaseDetail {
  return {
    id: "case-1",
    case_number: "PS-001",
    title: "Test case",
    problem_statement: null,
    background: null,
    business_impact: null,
    scope_in: null,
    scope_out: null,
    target_condition: null,
    detected_at: null,
    status: "draft",
    severity: "moderate",
    priority: "medium",
    organisation_unit_id: "unit-1",
    unit_name: "Line 1",
    owner_membership_id: "mem-1",
    facilitator_membership_id: null,
    method_version_id: null,
    current_method_stage_id: null,
    current_stage: null,
    closure_outcome: null,
    closure_rationale: null,
    transferred_to_reference: null,
    closed_at: null,
    closed_by_membership_id: null,
    cancellation_rationale: null,
    cancelled_at: null,
    cancelled_by_membership_id: null,
    target_due_at: null,
    activated_at: null,
    created_by_membership_id: "mem-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    status_history: [],
    stage_history: [],
    hypotheses: [],
    countermeasures: [],
    effectiveness_checks: [],
    sustainment_items: [],
    lessons_learned: [],
    sessions: [],
    actions: [],
    evidence_links: [],
    source_links: [],
    ...overrides,
  };
}

describe("SessionsPanel", () => {
  it("blocks facilitator start UI on draft cases", () => {
    render(
      <SessionsPanel
        caseId="case-1"
        detail={detailFixture({ status: "draft" })}
        canFacilitate
        membershipNameById={{}}
      />,
    );

    expect(screen.getByTestId("sessions-draft-blocked")).toBeVisible();
    expect(screen.queryByTestId("start-session-button")).not.toBeInTheDocument();
  });

  it("shows start session affordance on active cases", () => {
    render(
      <SessionsPanel
        caseId="case-1"
        detail={detailFixture({ status: "active" })}
        canFacilitate
        membershipNameById={{}}
      />,
    );

    expect(screen.getByTestId("start-session-button")).toBeVisible();
    expect(screen.getByTestId("sessions-empty")).toHaveTextContent(
      "Start a workshop session above",
    );
  });
});
