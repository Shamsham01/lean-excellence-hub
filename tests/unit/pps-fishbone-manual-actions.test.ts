import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/billing/assert-module-write", () => ({
  assertPlanModuleWrite: vi.fn(async () => ({ ok: true })),
}));

const rpcMock = vi.fn();
const assertEditMock = vi.fn();
const untypedFromMock = vi.fn();

vi.mock("@/lib/problem-solving/assert-can-edit-case-definition", () => ({
  assertCanEditCaseDefinition: (...args: unknown[]) => assertEditMock(...args),
}));

const callProblemSolvingRpcMock = vi.fn(async () => ({
  data: { id: "case-1", status: "active" },
  error: null,
}));

vi.mock("@/lib/problem-solving/supabase-untyped", () => ({
  untypedFrom: (...args: unknown[]) => untypedFromMock(...args),
  callProblemSolvingRpc: (
    ..._args: [unknown, string, Record<string, unknown>?]
  ) => callProblemSolvingRpcMock(),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

function nodeQueryChain(row: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: row ? [row] : [], error: null })),
  };
}

function analysisQueryChain(found: boolean) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: found ? { id: "analysis-1" } : null,
      error: null,
    })),
    order: vi.fn().mockReturnThis(),
  };
}

describe("manual fishbone and hypothesis server actions", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    assertEditMock.mockReset();
    untypedFromMock.mockReset();
    assertEditMock.mockResolvedValue({ ok: true });
  });

  it("promoteFishboneCauseToHypothesis skips RPC when already linked", async () => {
    untypedFromMock.mockImplementation((_client, table: string) => {
      if (table === "problem_solving_analysis_nodes") {
        return nodeQueryChain({
          id: "node-1",
          label: "Heat soak wear",
          category: "machine",
          linked_hypothesis_id: "hypothesis-1",
          analysis_id: "analysis-1",
        });
      }
      return analysisQueryChain(true);
    });
    const { promoteFishboneCauseToHypothesis } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await promoteFishboneCauseToHypothesis({
      caseId: "case-1",
      nodeId: "node-1",
    });
    expect(result.error).toBe(
      "This cause is already promoted to a hypothesis.",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("promoteFishboneCauseToHypothesis creates and links when clear", async () => {
    untypedFromMock.mockImplementation((_client, table: string) => {
      if (table === "problem_solving_analysis_nodes") {
        return nodeQueryChain({
          id: "node-1",
          label: "Heat soak wear",
          category: "machine",
          linked_hypothesis_id: null,
          analysis_id: "analysis-1",
        });
      }
      return analysisQueryChain(true);
    });
    rpcMock.mockResolvedValueOnce({ data: "hypothesis-new", error: null });
    const { promoteFishboneCauseToHypothesis } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await promoteFishboneCauseToHypothesis({
      caseId: "case-1",
      nodeId: "node-1",
    });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("hypothesis-new");
    expect(rpcMock).toHaveBeenCalledWith(
      "promote_analysis_node_to_hypothesis",
      {
        target_node_id: "node-1",
        target_category: "machine",
      },
    );
  });

  it("updateFishboneCause refuses promoted causes before RPC", async () => {
    untypedFromMock.mockImplementation((_client, table: string) => {
      if (table === "problem_solving_analysis_nodes") {
        return nodeQueryChain({
          id: "node-1",
          label: "Wear",
          category: "machine",
          linked_hypothesis_id: "hypothesis-1",
          analysis_id: "analysis-1",
        });
      }
      return analysisQueryChain(true);
    });
    const { updateFishboneCause } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await updateFishboneCause({
      caseId: "case-1",
      nodeId: "node-1",
      label: "New label",
    });
    expect(result.error).toBe("Promoted, edit the hypothesis instead.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("addFishboneCause rejects blank labels before RPC", async () => {
    const { addFishboneCause } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await addFishboneCause({
      caseId: "case-1",
      category: "machine",
      label: "   ",
    });
    expect(result.error).toBe("Cause description is required.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("createManualCauseHypothesis refuses edits when unauthorised", async () => {
    assertEditMock.mockResolvedValueOnce({
      error: "Case definition edits are not authorised.",
    });
    const { createManualCauseHypothesis } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await createManualCauseHypothesis({
      caseId: "case-1",
      statement: "Seal alignment drift",
    });
    expect(result.error).toBe("Case definition edits are not authorised.");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
