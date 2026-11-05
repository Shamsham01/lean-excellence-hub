import { describe, expect, it } from "vitest";

import { ProblemSolvingProposalBuffer } from "@/platform/ai/tools/proposal-tool-buffer";
import {
  buildOpenAiTools,
  parseToolArgs,
  PROBLEM_SOLVING_WRITE_TOOLS,
} from "@/platform/ai/tools/problem-solving-schemas";
import { validateProposalPayload } from "@/platform/ai/proposals/contracts";

describe("problem solving Lean AI write tools", () => {
  it("registers all propose_* tools for the provider", () => {
    const tools = buildOpenAiTools();
    for (const name of PROBLEM_SOLVING_WRITE_TOOLS) {
      expect(tools.some((tool) => tool.name === name)).toBe(true);
    }
  });

  it("queues validated draft proposals from tool arguments", () => {
    const buffer = new ProblemSolvingProposalBuffer();
    const args = parseToolArgs("propose_hypothesis", {
      statement: "Seal alignment drifts after heat soak.",
      category: "machine",
      rationale: null,
      parent_hypothesis_id: null,
      explanation: "Testable machine-side hypothesis for the team to accept.",
    });
    buffer.queue(
      "hypothesis",
      {
        statement: args.statement as string,
        category: args.category as string,
        rationale: args.rationale as string | undefined,
      },
      args.explanation as string,
    );
    const drained = buffer.drain();
    expect(drained).toHaveLength(1);
    const queued = drained[0]!;
    expect(queued.proposal_type).toBe("hypothesis");
    validateProposalPayload("hypothesis", queued.payload);
  });

  it("validates a five why chain proposal payload", () => {
    const args = parseToolArgs("propose_five_why_chain", {
      title: "Line 3 seal leak",
      steps: [
        { label: "Why is oil leaking?", evidence: "Visual inspection" },
        { label: "Why is the seal misaligned?", evidence: null },
      ],
      root_cause_summary: "Fixture wear allows seal drift.",
      explanation: "Draft chain from current observations.",
    });
    const payload = {
      title: args.title as string,
      steps: args.steps as Array<{ label: string; evidence?: string }>,
      root_cause_summary: args.root_cause_summary as string,
    };
    validateProposalPayload("five_why_chain", payload);
  });
});
