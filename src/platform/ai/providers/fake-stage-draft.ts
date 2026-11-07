import {
  primaryWriteToolForStage,
  writeToolsForStage,
} from "@/lib/problem-solving/stage-draft";
import type { ProblemSolvingWriteToolName } from "@/platform/ai/tools/problem-solving-schemas";
import type { CreateResponseResult } from "@/platform/ai/types";

function sampleArgsForWriteTool(
  tool: ProblemSolvingWriteToolName,
): Record<string, unknown> {
  switch (tool) {
    case "propose_problem_statement":
      return {
        statement: "Seal misalignment after splice events on Line 1.",
        explanation: "DEFINE stage draft for human acceptance.",
      };
    case "propose_target_condition":
      return {
        statement: "Film wander within ±2 mm for five consecutive shifts.",
        explanation: "Target condition draft.",
      };
    case "propose_current_condition_item":
      return {
        category: "measured_fact",
        statement: "Hot-running defect rate is 2.4× cold-start baseline.",
        explanation: "Measured current-condition draft.",
      };
    case "propose_hypothesis":
      return {
        statement: "Seal fixture drifts after sustained heat.",
        category: "machine",
        rationale: "Defects cluster after long hot runs.",
        explanation: "Testable machine hypothesis.",
      };
    case "propose_five_why_chain":
      return {
        title: "Line 1 film wander",
        steps: [
          {
            label: "Why does the film wander after splice?",
            evidence: "QC trend after splice events",
          },
          {
            label: "Why is guide position unstable?",
            evidence: null,
          },
        ],
        root_cause_summary: null,
        explanation: "Draft 5 Why chain from case context.",
      };
    case "propose_fishbone_cause":
      return {
        analysis_title: "Film wander fishbone",
        label: "Guide roller wear after heat soak",
        category: "machine",
        explanation: "Fishbone machine branch draft.",
      };
    case "propose_countermeasure":
      return {
        title: "Replace guide roller on PM schedule",
        description: "Inspect and replace rollers showing heat discoloration.",
        rationale: "Addresses machine drift hypothesis.",
        explanation: "Countermeasure draft.",
      };
    case "propose_universal_action":
      return {
        title: "Install weekly guide roller inspection",
        description: "Verify roller wear chart on Line 1.",
        context_role: "countermeasure",
        explanation: "Implementation action draft.",
      };
    case "propose_effectiveness_check":
      return {
        criterion: "Film wander stays within ±2 mm for five shifts.",
        baseline_description: "Currently 5–8 mm after splice.",
        target_description: "≤2 mm for five shifts.",
        explanation: "Effectiveness check draft.",
      };
    case "propose_sustainment_item":
      return {
        what: "Guide roller wear check on line start-up checklist",
        check_method: "Visual wear gauge at shift start",
        explanation: "Sustainment draft.",
      };
    case "propose_lessons_learned":
      return {
        what_happened: "Film wander spiked after splice events.",
        what_learned: "Heat-soaked rollers need earlier replacement.",
        standardise: "Add roller inspection to PM",
        explanation: "Lessons learned draft.",
      };
    case "propose_containment":
      return {
        description: "Hold last three hot-run batches pending verification.",
        rationale: "Limit customer exposure.",
        explanation: "Containment draft.",
      };
    default:
      return {
        statement: "Draft placeholder",
        explanation: "Stage draft placeholder.",
      };
  }
}

/**
 * When E2E/unit sends a stage auto-draft prompt (names propose_* tools), return a
 * single write tool call so Draft this stage yields pending proposals.
 */
export function fakeStageDraftToolResponse(
  userMessage: string,
  tools: Array<Record<string, unknown>>,
): CreateResponseResult | null {
  const hasStageDraftCue =
    userMessage.toLowerCase().includes("queue at least") ||
    /propose_[a-z_]+/.test(userMessage);
  if (!hasStageDraftCue) {
    return null;
  }

  const allowedNames = new Set(
    tools
      .map((tool) => tool.name)
      .filter((name): name is string => typeof name === "string"),
  );

  let chosen: ProblemSolvingWriteToolName | null = null;
  for (const tool of writeToolsForStage(
    inferStageFromPrompt(userMessage) ?? "DEFINE",
  )) {
    if (userMessage.includes(tool) && allowedNames.has(tool)) {
      chosen = tool;
      break;
    }
  }

  if (!chosen) {
    const stage = inferStageFromPrompt(userMessage);
    const primary = primaryWriteToolForStage(stage);
    if (allowedNames.has(primary)) {
      chosen = primary;
    }
  }

  if (!chosen) {
    return null;
  }

  return {
    outputText: "Stage draft queued for your review.",
    structuredOutput: {
      message: "Stage draft queued for your review.",
      observations: [],
      questions: [],
      warnings: [],
      source_refs: [],
      proposals: [],
    },
    toolCalls: [
      {
        id: `fake-stage-draft-${chosen}`,
        name: chosen,
        arguments: sampleArgsForWriteTool(chosen),
      },
    ],
    usage: {
      inputTokens: 32,
      outputTokens: 48,
      cachedInputTokens: 0,
      reasoningTokens: 0,
    },
  };
}

function inferStageFromPrompt(message: string): string | null {
  const toolMatch = message.match(/propose_[a-z_]+/);
  if (toolMatch) {
    const tool = toolMatch[0];
    for (const stage of [
      "DEFINE",
      "CURRENT_CONDITION",
      "TARGET_CONDITION",
      "ROOT_CAUSE_ANALYSIS",
      "COUNTERMEASURES",
      "IMPLEMENTATION",
      "EFFECTIVENESS_CHECK",
      "SUSTAINMENT",
    ]) {
      if (
        writeToolsForStage(stage).includes(tool as ProblemSolvingWriteToolName)
      ) {
        return stage;
      }
    }
  }
  return null;
}
