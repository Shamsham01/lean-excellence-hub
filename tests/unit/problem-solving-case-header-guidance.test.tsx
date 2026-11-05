import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseHeader } from "@/components/problem-solving/case-header";
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

const baseDetail: ProblemSolvingCaseDetail = {
  id: "case-1",
  case_number: null,
  title: "Draft title",
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
  unit_name: null,
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
};

const sampleMethod = {
  id: "method-1",
  name: "A3",
  code: "a3",
  description: null,
  is_builtin: true,
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  current_version: null,
};

describe("CaseHeader guidance", () => {
  it("shows draft guidance and activate controls when methods exist", () => {
    render(
      <CaseHeader
        detail={baseDetail}
        methodStages={[]}
        canManage
        canFacilitate={false}
        canClose={false}
        methods={[sampleMethod]}
        pinnedMethodVersion={null}
      />,
    );

    expect(screen.getByTestId("problem-solving-draft-guidance")).toBeVisible();
    expect(screen.getByTestId("problem-solving-activate-button")).toBeVisible();
  });

  it("warns when no methods are configured", () => {
    render(
      <CaseHeader
        detail={baseDetail}
        methodStages={[]}
        canManage
        canFacilitate={false}
        canClose={false}
        methods={[]}
        pinnedMethodVersion={null}
      />,
    );

    expect(screen.getByTestId("problem-solving-no-methods")).toBeVisible();
  });
});
