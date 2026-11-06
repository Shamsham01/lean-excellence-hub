import { describe, expect, it } from "vitest";

import { pendingAiProposalMatchesViewStage } from "@/lib/problem-solving/ai-proposal-stage";

describe("pendingAiProposalMatchesViewStage", () => {
  it("shows TARGET_CONDITION only when the tab matches", () => {
    const proposal = {
      proposal_type: "target_condition",
      semantic_stage_key: "TARGET_CONDITION",
    };
    expect(
      pendingAiProposalMatchesViewStage({
        ...proposal,
        viewStageKey: "TARGET_CONDITION",
      }),
    ).toBe(true);
    expect(
      pendingAiProposalMatchesViewStage({
        ...proposal,
        viewStageKey: "ROOT_CAUSE_ANALYSIS",
      }),
    ).toBe(false);
  });

  it("falls back to proposal type when semantic_stage_key is missing", () => {
    expect(
      pendingAiProposalMatchesViewStage({
        proposal_type: "hypothesis",
        semantic_stage_key: null,
        viewStageKey: "ROOT_CAUSE_ANALYSIS",
      }),
    ).toBe(true);
    expect(
      pendingAiProposalMatchesViewStage({
        proposal_type: "target_condition",
        semantic_stage_key: null,
        viewStageKey: "ROOT_CAUSE_ANALYSIS",
      }),
    ).toBe(false);
  });

  it("maps ANALYSE tab to ROOT_CAUSE_ANALYSIS proposals", () => {
    expect(
      pendingAiProposalMatchesViewStage({
        proposal_type: "hypothesis",
        semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
        viewStageKey: "ANALYSE",
      }),
    ).toBe(true);
  });
});
