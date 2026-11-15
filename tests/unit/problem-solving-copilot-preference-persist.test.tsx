import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ppsCopilotStorageKey,
  writePpsCopilotPreference,
} from "@/lib/problem-solving/copilot-preference";

const CASE_ID = "pref-guard-case";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/platform/problem-solving/x",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (node: ReactNode) => node };
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
  AiFacilitatorPanel: () => null,
}));

vi.mock("@/lib/problem-solving/problem-solving-ai-turn-client", () => ({
  invokeProblemSolvingTurnAction: vi.fn(),
  shouldRetainProblemSolvingTurnKey: () => false,
}));

describe("CaseWorkspace copilot preference persistence", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    writePpsCopilotPreference(CASE_ID, {
      dockCollapsed: true,
      mobileOpen: false,
    });
    setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    HTMLElement.prototype.scrollTo = vi.fn();
    window.sessionStorage.setItem("pps-disable-stage-auto-draft", "1");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    setItemSpy.mockRestore();
    window.localStorage.removeItem(ppsCopilotStorageKey(CASE_ID));
  });

  it("does not overwrite a stored preference with SSR defaults on mount", async () => {
    const { CaseWorkspace } =
      await import("@/components/problem-solving/case-workspace");

    const minimalProps = {
      detail: {
        id: CASE_ID,
        case_number: null,
        title: "Test",
        problem_statement: "Problem",
        background: null,
        business_impact: null,
        scope_in: null,
        scope_out: null,
        target_condition: null,
        detected_at: null,
        status: "active",
        severity: null,
        priority: null,
        organisation_unit_id: "u1",
        unit_name: null,
        owner_membership_id: "o1",
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
        created_by_membership_id: "o1",
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
      },
      currentConditionItems: [],
      containments: [],
      analyses: [],
      analysisNodes: [],
      hypothesisTests: [],
      methodStages: [],
      methods: [],
      pinnedMethodVersion: null,
      comments: [],
      evidence: [],
      membershipNameById: {},
      auditActivity: [],
      canManage: true,
      canContribute: true,
      canFacilitate: false,
      canVerifyCause: false,
      canEditCaseDefinition: false,
      canClose: false,
      canUseAi: true,
      providerAvailable: true,
    };

    await act(async () => {
      render(<CaseWorkspace {...minimalProps} />);
    });

    const defaultWrites = setItemSpy.mock.calls.filter(
      ([, value]: [string, string]) => {
      try {
        const parsed = JSON.parse(String(value)) as {
          dockCollapsed?: boolean;
          mobileOpen?: boolean;
        };
        return parsed.dockCollapsed === false && parsed.mobileOpen === false;
      } catch {
        return false;
      }
      },
    );

    expect(defaultWrites).toHaveLength(0);
  });
});
