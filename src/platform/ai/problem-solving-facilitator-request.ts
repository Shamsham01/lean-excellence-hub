import type { AiSessionMode } from "@/platform/ai/types";
import { buildOperationalRetrievalOpenAiTools } from "@/platform/ai/tools/operational-retrieval-schemas";
import {
  PROBLEM_SOLVING_TOOLS,
  buildOpenAiTools,
} from "@/platform/ai/tools/problem-solving-schemas";

/** Maximum OpenAI function tools on a Problem Solving facilitator provider request. */
export const PROBLEM_SOLVING_FACILITATOR_MAX_TOOLS = 27;

/**
 * Cross-module operational retrieval adds strict schemas and measurable first-hop
 * latency on the Responses API. Attach only for modes where cross-module Q&A is
 * the primary intent; Facilitate stays on in-case Problem Solving tools (v7 budget).
 */
export function facilitatorIncludesOperationalRetrieval(
  mode: AiSessionMode,
): boolean {
  return mode === "ask" || mode === "review" || mode === "challenge";
}

export function buildProblemSolvingFacilitatorProviderTools(input: {
  mode: AiSessionMode;
  stageDraftTools?: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  if (input.stageDraftTools) {
    return input.stageDraftTools;
  }
  const tools = buildOpenAiTools();
  if (facilitatorIncludesOperationalRetrieval(input.mode)) {
    return [...tools, ...buildOperationalRetrievalOpenAiTools()];
  }
  return tools;
}

export function problemSolvingFacilitatorToolNames(
  mode: AiSessionMode,
): readonly string[] {
  const names: string[] = [...PROBLEM_SOLVING_TOOLS];
  if (facilitatorIncludesOperationalRetrieval(mode)) {
    for (const tool of buildOperationalRetrievalOpenAiTools()) {
      const name = tool.name;
      if (typeof name === "string") {
        names.push(name);
      }
    }
  }
  return names;
}
