import type { ReactNode } from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    const workspace = (
      <CaseWorkspace
        detail={baseDetail}
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
        canVerifyCause={false}
        canEditCaseDefinition={false}
        canClose={false}
        canUseAi
        providerAvailable
        pendingAiProposals={[]}
      />
    );

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
});
