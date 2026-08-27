import { z } from "zod";

import { zodToJsonSchema } from "@/platform/ai/zod-to-json-schema";

export const emptyToolArgsSchema = z.object({}).strict();

export const hypothesisFilterSchema = z
  .object({
    status: z.string().optional(),
  })
  .strict();

export const searchRelatedCasesSchema = z
  .object({
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export const PROBLEM_SOLVING_READ_TOOLS = [
  "get_problem_solving_case_overview",
  "get_current_condition",
  "get_containments",
  "get_hypotheses",
  "get_hypothesis_tests",
  "get_cause_analysis",
  "get_countermeasures",
  "get_case_actions",
  "get_effectiveness_checks",
  "get_sustainment",
  "get_problem_solving_sessions",
  "get_lessons_learned",
  "search_related_problem_solving_cases",
] as const;

export type ProblemSolvingToolName =
  (typeof PROBLEM_SOLVING_READ_TOOLS)[number];

export function getToolJsonSchema(
  name: ProblemSolvingToolName,
): Record<string, unknown> {
  switch (name) {
    case "get_hypotheses":
      return zodToJsonSchema(hypothesisFilterSchema);
    case "search_related_problem_solving_cases":
      return zodToJsonSchema(searchRelatedCasesSchema);
    default:
      return zodToJsonSchema(emptyToolArgsSchema);
  }
}

export function parseToolArgs(
  name: ProblemSolvingToolName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  switch (name) {
    case "get_hypotheses":
      return hypothesisFilterSchema.parse(raw);
    case "search_related_problem_solving_cases":
      return searchRelatedCasesSchema.parse(raw);
    default:
      return emptyToolArgsSchema.parse(raw);
  }
}

export function buildOpenAiTools(): Array<Record<string, unknown>> {
  return PROBLEM_SOLVING_READ_TOOLS.map((name) => ({
    type: "function",
    name,
    description: `Read authorised problem-solving data for the current case. Tool: ${name}`,
    parameters: getToolJsonSchema(name),
    strict: true,
  }));
}
