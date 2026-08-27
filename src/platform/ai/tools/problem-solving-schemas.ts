import { z } from "zod";

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

const emptyToolParametersSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

const hypothesisFilterParametersSchema = {
  type: "object",
  properties: {
    status: {
      type: ["string", "null"],
    },
  },
  required: ["status"],
  additionalProperties: false,
} as const;

const searchRelatedCasesParametersSchema = {
  type: "object",
  properties: {
    limit: {
      type: ["integer", "null"],
      minimum: 1,
      maximum: 20,
    },
  },
  required: ["limit"],
  additionalProperties: false,
} as const;

export function getOpenAiToolParametersSchema(
  name: ProblemSolvingToolName,
): Record<string, unknown> {
  switch (name) {
    case "get_hypotheses":
      return hypothesisFilterParametersSchema;
    case "search_related_problem_solving_cases":
      return searchRelatedCasesParametersSchema;
    default:
      return emptyToolParametersSchema;
  }
}

export {
  emptyToolParametersSchema,
  hypothesisFilterParametersSchema,
  searchRelatedCasesParametersSchema,
};

function normalizeToolTransportArgs(
  name: ProblemSolvingToolName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  switch (name) {
    case "get_hypotheses": {
      const status = raw.status;
      if (status === null || status === undefined) {
        return {};
      }
      return { status };
    }
    case "search_related_problem_solving_cases": {
      const limit = raw.limit;
      if (limit === null || limit === undefined) {
        return {};
      }
      return { limit };
    }
    default:
      return raw;
  }
}

export function parseToolArgs(
  name: ProblemSolvingToolName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const args = normalizeToolTransportArgs(name, raw);

  switch (name) {
    case "get_hypotheses":
      return hypothesisFilterSchema.parse(args);
    case "search_related_problem_solving_cases":
      return searchRelatedCasesSchema.parse(args);
    default:
      return emptyToolArgsSchema.parse(args);
  }
}

export function buildOpenAiTools(): Array<Record<string, unknown>> {
  return PROBLEM_SOLVING_READ_TOOLS.map((name) => ({
    type: "function",
    name,
    description: `Read authorised problem-solving data for the current case. Tool: ${name}`,
    parameters: getOpenAiToolParametersSchema(name),
    strict: true,
  }));
}
