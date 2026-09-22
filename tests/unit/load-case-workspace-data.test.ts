/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const throwPlatformBoundaryError = vi.fn((input: unknown) => {
  throw Object.assign(new Error("PlatformBoundaryError"), { input });
});
const readRequestPathname = vi.fn(async () => "/platform/problem-solving/case");

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

vi.mock("@/platform/observability/platform-boundary", () => ({
  PlatformBoundaryError: class PlatformBoundaryError extends Error {
    readonly category: string;
    constructor(input: {
      category: string;
      operation: string;
      reference: string;
    }) {
      super("PlatformBoundaryError");
      this.name = "PlatformBoundaryError";
      this.category = input.category;
    }
  },
  throwPlatformBoundaryError: (input: unknown) =>
    throwPlatformBoundaryError(input),
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: () => readRequestPathname(),
}));

const untypedFrom = vi.fn();
const callProblemSolvingRpc = vi.fn();

vi.mock("@/lib/problem-solving/supabase-untyped", () => ({
  untypedFrom: (...args: unknown[]) => untypedFrom(...args),
  callProblemSolvingRpc: (...args: unknown[]) => callProblemSolvingRpc(...args),
}));

import { UNAVAILABLE_MEMBER_LABEL } from "@/lib/identity/membership-display-label";
import { loadCaseWorkspaceData } from "@/lib/problem-solving/load-case-workspace-data";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/supabase/database.types";

const CASE_ID = "11111111-1111-1111-1111-111111111111";

const detailFixture: ProblemSolvingCaseDetail = {
  id: CASE_ID,
  case_number: "PS-001",
  title: "Seal defects",
  problem_statement: null,
  background: null,
  business_impact: null,
  scope_in: null,
  scope_out: null,
  target_condition: null,
  detected_at: null,
  status: "active",
  severity: "major",
  priority: "high",
  organisation_unit_id: "22222222-2222-2222-2222-222222222222",
  unit_name: "Line 3",
  owner_membership_id: "33333333-3333-3333-3333-333333333333",
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
  created_by_membership_id: "33333333-3333-3333-3333-333333333333",
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

function listQuery(result: { data: unknown[] | null; error: unknown }) {
  const orderMock = vi.fn().mockResolvedValue(result);
  const inResult = Object.assign(Promise.resolve(result), {
    order: orderMock,
  });

  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: orderMock,
      }),
      in: vi.fn().mockReturnValue(inResult),
    }),
  };
}

describe("loadCaseWorkspaceData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns genuinely empty subsidiary collections when queries succeed with no rows", async () => {
    untypedFrom.mockImplementation((_supabase, table: string) => {
      return listQuery({ data: [], error: null });
    });
    callProblemSolvingRpc.mockResolvedValue({
      data: { items: [] },
      error: null,
    });

    const commentsFrom = vi
      .fn()
      .mockImplementation(() => listQuery({ data: [], error: null }));

    const supabase = {
      from: commentsFrom,
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>;

    await expect(
      loadCaseWorkspaceData(supabase, CASE_ID, detailFixture),
    ).resolves.toMatchObject({
      currentConditionItems: [],
      containments: [],
      analyses: [],
      analysisNodes: [],
      hypothesisTests: [],
      methodStages: [],
      methods: [],
      comments: [],
      evidence: [],
      membershipNameById: {
        "33333333-3333-3333-3333-333333333333": UNAVAILABLE_MEMBER_LABEL,
      },
    });
    expect(commentsFrom).not.toHaveBeenCalledWith("organisation_memberships");
  });

  it("renders authorised owner and facilitator names without UUID prefixes", async () => {
    untypedFrom.mockImplementation(() => listQuery({ data: [], error: null }));
    callProblemSolvingRpc.mockResolvedValue({
      data: { items: [] },
      error: null,
    });

    const commentsFrom = vi
      .fn()
      .mockImplementation(() => listQuery({ data: [], error: null }));
    const supabase = {
      from: commentsFrom,
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>;

    const namedDetail: ProblemSolvingCaseDetail = {
      ...detailFixture,
      owner_display_name: "CookieWorks Admin",
      facilitator_membership_id: "44444444-4444-4444-4444-444444444444",
      facilitator_display_name: "Apex Facilitator",
      membership_display_names: {
        "33333333-3333-3333-3333-333333333333": "CookieWorks Admin",
        "44444444-4444-4444-4444-444444444444": "Apex Facilitator",
      },
    };

    const workspace = await loadCaseWorkspaceData(
      supabase,
      CASE_ID,
      namedDetail,
    );

    expect(workspace.membershipNameById).toEqual({
      "33333333-3333-3333-3333-333333333333": "CookieWorks Admin",
      "44444444-4444-4444-4444-444444444444": "Apex Facilitator",
    });
    expect(Object.values(workspace.membershipNameById).join("|")).not.toMatch(
      /05057700|[0-9a-f]{8}-[0-9a-f]{4}|^[0-9a-f]{8}$/i,
    );
    expect(commentsFrom).not.toHaveBeenCalledWith("organisation_memberships");
  });

  it("does not treat an opaque membership label as a display name", async () => {
    untypedFrom.mockImplementation(() => listQuery({ data: [], error: null }));
    callProblemSolvingRpc.mockResolvedValue({
      data: { items: [] },
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockImplementation(() => listQuery({ data: [], error: null })),
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>;

    const workspace = await loadCaseWorkspaceData(supabase, CASE_ID, {
      ...detailFixture,
      owner_display_name: "05057700",
      membership_display_names: {
        "33333333-3333-3333-3333-333333333333": "05057700",
      },
    });

    expect(
      workspace.membershipNameById["33333333-3333-3333-3333-333333333333"],
    ).toBe(UNAVAILABLE_MEMBER_LABEL);
  });

  it("raises a retryable boundary instead of partial empty workspace on infra failure", async () => {
    untypedFrom.mockImplementation((_supabase, table: string) => {
      if (table === "problem_solving_current_condition_items") {
        return listQuery({
          data: null,
          error: {
            code: "57014",
            message: "canceling statement due to timeout",
          },
        });
      }

      return listQuery({ data: [], error: null });
    });
    callProblemSolvingRpc.mockResolvedValue({
      data: { items: [{ id: "method-1", name: "A3" }] },
      error: null,
    });

    const commentsFrom = vi.fn().mockImplementation(() =>
      listQuery({
        data: [
          {
            id: "comment-1",
            body: "note",
            created_at: "2026-01-01",
            author_membership_id: "33333333-3333-3333-3333-333333333333",
          },
        ],
        error: null,
      }),
    );

    const supabase = {
      from: commentsFrom,
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>;

    await expect(
      loadCaseWorkspaceData(supabase, CASE_ID, detailFixture),
    ).rejects.toThrow("PlatformBoundaryError");

    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "organisation_access",
        operation: "problem_solving_current_condition_items",
      }),
    );
  });
});
