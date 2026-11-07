import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { guidedStageConfig } from "@/lib/problem-solving/guided-flow";
import {
  PROBLEM_SOLVING_BUILTIN_METHOD_STAGES,
  assertStageDraftCoverage,
  buildOpenAiToolsForStage,
  buildStageAutoDraftPrompt,
  countPendingProposalsForViewStage,
  primaryWriteToolForStage,
  resolveCanonicalStageKey,
  writeToolsForStage,
} from "@/lib/problem-solving/stage-draft";
import { parseToolArgs } from "@/platform/ai/tools/problem-solving-schemas";
import { ProblemSolvingProposalBuffer } from "@/platform/ai/tools/proposal-tool-buffer";
import { validateProposalPayload } from "@/platform/ai/proposals/contracts";
import { fakeStageDraftToolResponse } from "@/platform/ai/providers/fake-stage-draft";

describe("problem solving stage draft coverage", () => {
  it.each(
    PROBLEM_SOLVING_BUILTIN_METHOD_STAGES.flatMap((method) =>
      method.stages.map((stage) => ({
        method: method.method,
        stage,
      })),
    ),
  )(
    "maps $method / $stage to at least one write tool and auto-draft prompt",
    ({ stage }) => {
      const tools = assertStageDraftCoverage(stage);
      expect(tools.length).toBeGreaterThan(0);
      const prompt = buildStageAutoDraftPrompt(stage);
      expect(prompt).toMatch(/propose_/);
      expect(prompt.toLowerCase()).toMatch(/queue at least/);
      const openAiTools = buildOpenAiToolsForStage(stage);
      for (const writeTool of tools) {
        expect(openAiTools.some((tool) => tool.name === writeTool)).toBe(true);
      }
    },
  );

  it("canonicalises ANALYSE to ROOT_CAUSE_ANALYSIS", () => {
    expect(resolveCanonicalStageKey("ANALYSE")).toBe("ROOT_CAUSE_ANALYSIS");
    expect(primaryWriteToolForStage("ANALYSE")).toBe("propose_five_why_chain");
  });

  it("counts pending proposals scoped to the viewed stage tab", () => {
    const count = countPendingProposalsForViewStage(
      [
        {
          proposal_type: "target_condition",
          status: "pending",
          semantic_stage_key: "TARGET_CONDITION",
        },
        {
          proposal_type: "five_why_chain",
          status: "pending",
          semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
        },
      ],
      "ROOT_CAUSE_ANALYSIS",
    );
    expect(count).toBe(1);
  });

  it("guided stage config uses central auto-draft prompts", () => {
    const config = guidedStageConfig("ROOT_CAUSE_ANALYSIS");
    expect(config.autoDraftPrompt).toMatch(/propose_five_why_chain/);
    expect(config.autoDraftPrompt).not.toMatch(/read tools first/i);
  });

  it("fake stage draft returns a valid queued proposal for ROOT_CAUSE_ANALYSIS", () => {
    const prompt = buildStageAutoDraftPrompt("ROOT_CAUSE_ANALYSIS");
    const tools = buildOpenAiToolsForStage("ROOT_CAUSE_ANALYSIS");
    const response = fakeStageDraftToolResponse(prompt, tools);
    expect(response?.toolCalls.length).toBe(1);
    const call = response?.toolCalls[0];
    expect(call?.name).toBe("propose_five_why_chain");
    const args = parseToolArgs("propose_five_why_chain", call?.arguments ?? {});
    const buffer = new ProblemSolvingProposalBuffer();
    buffer.queue(
      "five_why_chain",
      {
        title: args.title as string | undefined,
        steps: args.steps as Array<{ label: string; evidence?: string }>,
        root_cause_summary: args.root_cause_summary as string | undefined,
      },
      args.explanation as string,
    );
    validateProposalPayload("five_why_chain", buffer.drain()[0]!.payload);
  });
});

describe("stage draft mocked model responses", () => {
  it.each(
    PROBLEM_SOLVING_BUILTIN_METHOD_STAGES.flatMap((method) =>
      method.stages.map((stage) => ({ method: method.method, stage })),
    ),
  )(
    "fake provider returns a write tool for $method / $stage prompts",
    ({ stage }) => {
      const prompt = buildStageAutoDraftPrompt(stage);
      const tools = buildOpenAiToolsForStage(stage);
      const response = fakeStageDraftToolResponse(prompt, tools);
      expect(response?.toolCalls.length).toBeGreaterThanOrEqual(1);
      const toolName = response?.toolCalls[0]?.name ?? "";
      expect(writeToolsForStage(stage)).toContain(toolName);
    },
  );
});
