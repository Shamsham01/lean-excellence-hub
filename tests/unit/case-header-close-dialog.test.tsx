import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseHeader } from "@/components/problem-solving/case-header";
import { RESOLVED_CLOSURE_EFFECTIVENESS_BLOCK_REASON } from "@/lib/problem-solving/closure";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/problem-solving/actions", () => ({
  activateProblemSolvingCase: vi.fn(),
  cancelProblemSolvingCase: vi.fn(),
  closeProblemSolvingCase: vi.fn(),
  moveProblemSolvingStage: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const activeDetail: ProblemSolvingCaseDetail = {
  id: "case-close",
  case_number: "PS-100",
  title: "Closure gate case",
  problem_statement: null,
  background: null,
  business_impact: null,
  scope_in: null,
  scope_out: null,
  target_condition: null,
  detected_at: null,
  status: "active",
  severity: "moderate",
  priority: "medium",
  organisation_unit_id: "unit-1",
  unit_name: "Line 1",
  owner_membership_id: "mem-1",
  facilitator_membership_id: null,
  method_version_id: "mv-1",
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
  activated_at: "2026-01-02T00:00:00Z",
  created_by_membership_id: "mem-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  status_history: [],
  stage_history: [],
  hypotheses: [],
  countermeasures: [
    {
      id: "cm-1",
      title: "Fix rail",
      description: null,
      rationale: null,
      status: "selected",
      proposed_by_membership_id: "mem-1",
      selected_by_membership_id: null,
      selected_at: null,
      selected_rationale: null,
      rejected_by_membership_id: null,
      rejected_at: null,
      rejected_rationale: null,
      created_at: "2026-01-01T00:00:00Z",
      cause_links: [],
      evidence_links: [],
    },
  ],
  effectiveness_checks: [
    {
      id: "eff-1",
      criterion: "Defect rate",
      baseline_description: null,
      target_description: null,
      baseline_numeric: null,
      target_numeric: null,
      actual_numeric: null,
      unit: null,
      observation_window_start: null,
      observation_window_end: null,
      due_date: null,
      result: "inconclusive",
      verified_by_membership_id: null,
      verified_at: null,
      created_by_membership_id: "mem-1",
      created_at: "2026-01-02T00:00:00Z",
      evidence_links: [],
    },
  ],
  sustainment_items: [],
  lessons_learned: [],
  sessions: [],
  actions: [],
  evidence_links: [],
  source_links: [],
};

describe("CaseHeader close dialog", () => {
  it("disables resolved outcomes and shows block reason when effectiveness is not pass", () => {
    render(
      <CaseHeader
        detail={activeDetail}
        canManage
        canClose
        methods={[]}
        pinnedMethodVersion={null}
      />,
    );

    fireEvent.click(screen.getByTestId("problem-solving-close-button"));

    const select = screen.getByTestId("closure-outcome-select");
    const options = within(select).getAllByRole("option");
    const resolvedVerified = options.find(
      (opt) => opt.getAttribute("value") === "resolved_verified_cause",
    );
    const resolvedUnverified = options.find(
      (opt) => opt.getAttribute("value") === "resolved_without_verified_cause",
    );
    const transferred = options.find(
      (opt) => opt.getAttribute("value") === "transferred",
    );

    expect(resolvedVerified).toBeDisabled();
    expect(resolvedUnverified).toBeDisabled();
    expect(transferred).not.toBeDisabled();
    expect(
      screen.getByTestId("closure-resolved-blocked-reason"),
    ).toHaveTextContent(RESOLVED_CLOSURE_EFFECTIVENESS_BLOCK_REASON);
  });

  it("disables resolved outcomes when effectiveness checks exist and cm is ineffective", () => {
    const ineffectiveCm: ProblemSolvingCaseDetail = {
      ...activeDetail,
      countermeasures: [
        {
          ...activeDetail.countermeasures[0]!,
          status: "ineffective",
        },
      ],
    };

    render(
      <CaseHeader
        detail={ineffectiveCm}
        canManage
        canClose
        methods={[]}
        pinnedMethodVersion={null}
      />,
    );

    fireEvent.click(screen.getByTestId("problem-solving-close-button"));

    const select = screen.getByTestId("closure-outcome-select");
    const resolvedVerified = within(select)
      .getAllByRole("option")
      .find((opt) => opt.getAttribute("value") === "resolved_verified_cause");
    expect(resolvedVerified).toBeDisabled();
    expect(screen.getByTestId("closure-resolved-blocked-reason")).toBeVisible();
  });

  it("shows verified-cause note when no corrective countermeasure is in play", () => {
    const withoutCorrective: ProblemSolvingCaseDetail = {
      ...activeDetail,
      countermeasures: [
        {
          ...activeDetail.countermeasures[0]!,
          status: "proposed",
        },
      ],
      effectiveness_checks: [],
    };

    render(
      <CaseHeader
        detail={withoutCorrective}
        canManage
        canClose
        methods={[]}
        pinnedMethodVersion={null}
      />,
    );

    fireEvent.click(screen.getByTestId("problem-solving-close-button"));

    expect(
      screen.getByTestId("closure-verified-no-countermeasure-note"),
    ).toBeVisible();
    expect(screen.queryByTestId("closure-resolved-blocked-reason")).toBeNull();
  });
});
