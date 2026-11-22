import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acceptProblemSolvingAiProposal } from "@/app/(platform)/platform/problem-solving/ai/actions";
import type { CasePendingAiProposal } from "@/lib/problem-solving/load-case-pending-ai-proposals";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import {
  ppsCopilotStorageKey,
  writePpsCopilotPreference,
} from "@/lib/problem-solving/copilot-preference";

vi.mock("server-only", () => ({}));

const CASE_ID = "362c8a5a-0a85-4569-a870-a473864d33a9";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/platform/problem-solving/case-1",
  useSearchParams: () => new URLSearchParams("stage=ROOT_CAUSE_ANALYSIS"),
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    createPortal: (node: ReactNode) => node,
  };
});

vi.mock("@/app/(platform)/platform/problem-solving/actions", () => ({
  moveProblemSolvingStage: vi.fn(),
}));

vi.mock("@/app/(platform)/platform/problem-solving/ai/actions", () => ({
  acceptProblemSolvingAiProposal: vi.fn(),
  rejectProblemSolvingAiProposal: vi.fn(),
  draftProblemSolvingStage: vi.fn(),
  reconcileProblemSolvingStageDraft: vi.fn(),
}));

vi.mock("@/components/problem-solving/ai/ai-facilitator-panel", () => ({
  AiFacilitatorPanel: () => <div data-testid="ai-facilitator-mock" />,
}));

vi.mock("@/lib/problem-solving/problem-solving-ai-turn-client", () => ({
  invokeProblemSolvingTurnAction: vi.fn(),
  shouldRetainProblemSolvingTurnKey: () => false,
}));

const baseDetail: ProblemSolvingCaseDetail = {
  id: CASE_ID,
  case_number: "PPS-1",
  title: "Harbourfield seal defects",
  problem_statement: "Defect rate elevated on line 2",
  background: null,
  business_impact: null,
  scope_in: null,
  scope_out: null,
  target_condition: null,
  detected_at: null,
  status: "active",
  severity: "major",
  priority: "high",
  organisation_unit_id: "unit-1",
  unit_name: "Bodmin",
  owner_membership_id: "owner-1",
  facilitator_membership_id: null,
  method_version_id: "version-1",
  current_method_stage_id: "stage-rca",
  current_stage: {
    id: "stage-rca",
    title: "Root cause",
    display_order: 3,
    description: null,
    semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
  },
  closure_outcome: null,
  closure_rationale: null,
  transferred_to_reference: null,
  closed_at: null,
  closed_by_membership_id: null,
  cancellation_rationale: null,
  cancelled_at: null,
  cancelled_by_membership_id: null,
  target_due_at: null,
  sustain_plan_standardised: null,
  sustain_plan_owner_membership_id: null,
  sustain_plan_monitoring: null,
  sustain_plan_review_date: null,
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

const methodStages = [
  {
    id: "stage-define",
    method_version_id: "version-1",
    title: "Define",
    description: null,
    display_order: 1,
    semantic_stage_key: "DEFINE",
    stage_type: "standard",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "stage-rca",
    method_version_id: "version-1",
    title: "Root cause",
    description: null,
    display_order: 3,
    semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
    stage_type: "standard",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

function installMobileMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderWorkspace(
  CaseWorkspace: typeof import("@/components/problem-solving/case-workspace").CaseWorkspace,
  detail = baseDetail,
  pendingAiProposals: CasePendingAiProposal[] = [],
) {
  return (
    <CaseWorkspace
      detail={detail}
      currentConditionItems={[]}
      containments={[]}
      analyses={[]}
      analysisNodes={[]}
      hypothesisTests={[]}
      methodStages={methodStages}
      methods={[]}
      pinnedMethodVersion={null}
      comments={[]}
      evidence={[]}
      membershipNameById={{}}
      auditActivity={[]}
      canManage
      canContribute
      canFacilitate={false}
      canVerifyCause
      canEditCaseDefinition
      canClose={false}
      canUseAi
      providerAvailable
      pendingAiProposals={pendingAiProposals}
    />
  );
}

const pendingProposal: CasePendingAiProposal = {
  id: "proposal-1",
  proposal_type: "hypothesis",
  payload_json: {},
  human_explanation: "Check the seal alignment",
  status: "pending",
  ai_session_id: "session-1",
  semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
};

describe("CaseWorkspace SSR hydration", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    window.localStorage.clear();
    window.sessionStorage.setItem("pps-disable-stage-auto-draft", "1");
    writePpsCopilotPreference(CASE_ID, {
      dockCollapsed: true,
      mobileOpen: false,
    });
    installMobileMatchMedia();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(ppsCopilotStorageKey(CASE_ID));
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("hydrates without text/HTML mismatch when copilot is collapsed and viewport is mobile", async () => {
    const hydrationErrors: string[] = [];
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        const combined = args.map(String).join(" ");
        if (/hydration|did not match|418/i.test(combined)) {
          hydrationErrors.push(combined);
        }
      });

    const { CaseWorkspace } =
      await import("@/components/problem-solving/case-workspace");

    const workspace = renderWorkspace(CaseWorkspace);

    const html = renderToString(workspace);
    expect(html).toContain("Hide Lean AI");

    const container = document.createElement("div");
    container.innerHTML = html;

    await act(async () => {
      hydrateRoot(container, workspace);
    });

    expect(hydrationErrors).toEqual([]);
    consoleError.mockRestore();
  });

  it("shows a later stage as a read-only preview and enables editing once reached", async () => {
    const { CaseWorkspace } =
      await import("@/components/problem-solving/case-workspace");
    const define = methodStages[0]!;
    const view = render(
      renderWorkspace(
        CaseWorkspace,
        {
          ...baseDetail,
          problem_statement: null,
          current_method_stage_id: define.id,
          current_stage: define,
        },
        [pendingProposal],
      ),
    );
    expect(
      screen.getByTestId("pps-stage-not-reached-notice"),
    ).toHaveTextContent("Not yet reached");
    expect(screen.getByTestId("pps-stage-DEFINE")).toBeEnabled();
    expect(screen.getByTestId("pps-stage-ROOT_CAUSE_ANALYSIS")).toBeEnabled();
    expect(
      screen.queryByTestId("pps-manual-hypothesis-form"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("pps-stage-auto-draft-button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-proposal-accept")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-facilitator-mock")).not.toBeInTheDocument();
    view.rerender(
      renderWorkspace(CaseWorkspace, baseDetail, [pendingProposal]),
    );
    expect(
      screen.queryByTestId("pps-stage-not-reached-notice"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("pps-manual-hypothesis-form"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ai-proposal-accept")).toBeEnabled();
  });

  it("counts only proposals shown in the stage list and removes accepted ones before refresh", async () => {
    const { CaseWorkspace } =
      await import("@/components/problem-solving/case-workspace");
    vi.mocked(acceptProblemSolvingAiProposal).mockResolvedValue({ ok: true });
    render(
      renderWorkspace(CaseWorkspace, baseDetail, [
        pendingProposal,
        { ...pendingProposal, id: "done", status: "accepted" },
        { ...pendingProposal, id: "other-stage", semantic_stage_key: "DEFINE" },
      ]),
    );

    expect(screen.getAllByTestId("ai-proposal-card")).toHaveLength(1);
    expect(screen.getByTestId("pps-stage-auto-draft-status")).toHaveTextContent(
      "1 proposal(s) ready",
    );
    fireEvent.click(screen.getByTestId("ai-proposal-accept"));

    await waitFor(() =>
      expect(screen.queryByTestId("ai-proposal-card")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("pps-stage-auto-draft-status"),
    ).not.toBeInTheDocument();
  });
});
