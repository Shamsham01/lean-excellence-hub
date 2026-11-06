import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateProblemSolvingCase,
  startProblemSolvingSession,
} from "@/app/(platform)/platform/problem-solving/actions";
import { CaseHeader } from "@/components/problem-solving/case-header";
import { SessionsPanel } from "@/components/problem-solving/sessions-panel";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerMocks.refresh,
    push: vi.fn(),
  }),
}));

vi.mock("@/app/(platform)/platform/problem-solving/actions", () => ({
  activateProblemSolvingCase: vi.fn(),
  cancelProblemSolvingCase: vi.fn(),
  closeProblemSolvingCase: vi.fn(),
  moveProblemSolvingStage: vi.fn(),
  startProblemSolvingSession: vi.fn(),
  addSessionEntry: vi.fn(),
  completeProblemSolvingSession: vi.fn(),
}));

const activateCase = vi.mocked(activateProblemSolvingCase);
const startSession = vi.mocked(startProblemSolvingSession);

const baseDetail: ProblemSolvingCaseDetail = {
  id: "case-1",
  case_number: null,
  title: "Seal defects",
  problem_statement: null,
  background: null,
  business_impact: null,
  scope_in: null,
  scope_out: null,
  target_condition: null,
  detected_at: null,
  status: "draft",
  severity: "major",
  priority: "high",
  organisation_unit_id: "unit-1",
  unit_name: "Line 3",
  owner_membership_id: "owner-1",
  facilitator_membership_id: null,
  method_version_id: "version-a3-1",
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
  created_by_membership_id: "owner-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
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
};

describe("CaseHeader activation UX", () => {
  beforeEach(() => {
    routerMocks.refresh.mockReset();
    activateCase.mockReset();
  });

  it("shows a locked method label for pinned drafts and keeps errors local", async () => {
    activateCase.mockResolvedValueOnce({ error: "Activation failed" });

    render(
      <CaseHeader
        detail={baseDetail}
        canManage
        canClose={false}
        methods={[
          {
            id: "method-a3",
            name: "A3 / 8-Step Structured Problem Solving",
            code: "a3-structured",
            description: null,
            is_builtin: true,
            status: "active",
            created_at: "2026-01-01T00:00:00.000Z",
            current_version: {
              id: "version-a3-1",
              version_number: 1,
              status: "published",
              stages: [],
            },
          },
        ]}
        pinnedMethodVersion={{
          methodId: "method-a3",
          methodName: "A3 / 8-Step Structured Problem Solving",
          methodCode: "a3-structured",
          versionNumber: 1,
          versionStatus: "published",
        }}
      />,
    );

    expect(screen.getByTestId("activate-method-locked")).toBeVisible();
    expect(screen.queryByTestId("activate-method-select")).toBeNull();

    fireEvent.click(screen.getByTestId("problem-solving-activate-button"));

    await waitFor(() => {
      expect(
        screen.getByTestId("problem-solving-activate-feedback"),
      ).toHaveTextContent("Activation failed");
    });
    expect(routerMocks.refresh).not.toHaveBeenCalled();
    expect(activateCase).toHaveBeenCalledWith("case-1", "method-a3");
  });
});

describe("SessionsPanel draft guidance", () => {
  beforeEach(() => {
    routerMocks.refresh.mockReset();
    startSession.mockReset();
  });

  it("guides facilitators on draft cases and preserves the title when start fails", async () => {
    startSession.mockResolvedValueOnce({
      error: "sessions can only be started on active cases",
    });

    const { rerender } = render(
      <SessionsPanel
        caseId="case-1"
        detail={baseDetail}
        canFacilitate
        membershipNameById={{}}
      />,
    );

    expect(screen.getByTestId("sessions-draft-blocked")).toBeVisible();
    expect(screen.queryByTestId("start-session-button")).toBeNull();

    const activeDetail = { ...baseDetail, status: "active" };
    rerender(
      <SessionsPanel
        caseId="case-1"
        detail={activeDetail}
        canFacilitate
        membershipNameById={{}}
      />,
    );

    const titleInput = screen.getByTestId("session-title");
    fireEvent.change(titleInput, { target: { value: "Line 3 workshop" } });
    fireEvent.click(screen.getByTestId("start-session-button"));

    await waitFor(() => {
      expect(screen.getByTestId("sessions-panel-message")).toHaveTextContent(
        "sessions can only be started on active cases",
      );
    });
    expect(titleInput).toHaveValue("Line 3 workshop");
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});
