import { z } from "zod";

import { HYPOTHESIS_CATEGORIES } from "@/lib/problem-solving/hypothesis";
import { CURRENT_CONDITION_CATEGORIES } from "@/lib/problem-solving/types";

export const emptyToolArgsSchema = z.object({}).strict();

const explanationField = z.string().trim().min(1).max(4000);

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

export const PROBLEM_SOLVING_WRITE_TOOLS = [
  "propose_problem_statement",
  "propose_target_condition",
  "propose_current_condition_item",
  "propose_hypothesis",
  "propose_containment",
  "propose_countermeasure",
  "propose_five_why_chain",
  "propose_fishbone_cause",
] as const;

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

export const PROBLEM_SOLVING_TOOLS = [
  ...PROBLEM_SOLVING_READ_TOOLS,
  ...PROBLEM_SOLVING_WRITE_TOOLS,
] as const;

export type ProblemSolvingToolName = (typeof PROBLEM_SOLVING_TOOLS)[number];

export type ProblemSolvingWriteToolName =
  (typeof PROBLEM_SOLVING_WRITE_TOOLS)[number];

const proposeProblemStatementSchema = z
  .object({
    statement: z.string().trim().min(1).max(4000),
    explanation: explanationField,
  })
  .strict();

const proposeTargetConditionSchema = z
  .object({
    statement: z.string().trim().min(1).max(4000),
    explanation: explanationField,
  })
  .strict();

const proposeCurrentConditionSchema = z
  .object({
    category: z.enum(CURRENT_CONDITION_CATEGORIES),
    statement: z.string().trim().min(1).max(2000),
    explanation: explanationField,
  })
  .strict();

const proposeHypothesisSchema = z
  .object({
    statement: z.string().trim().min(1).max(2000),
    category: z.enum(HYPOTHESIS_CATEGORIES).optional(),
    rationale: z.string().trim().max(2000).optional(),
    parent_hypothesis_id: z.string().uuid().optional(),
    explanation: explanationField,
  })
  .strict();

const proposeContainmentSchema = z
  .object({
    description: z.string().trim().min(1).max(2000),
    rationale: z.string().trim().max(2000).optional(),
    explanation: explanationField,
  })
  .strict();

const proposeCountermeasureSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    rationale: z.string().trim().max(2000).optional(),
    hypothesis_ids: z.array(z.string().uuid()).max(10).optional(),
    explanation: explanationField,
  })
  .strict();

const proposeFiveWhyChainSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    steps: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(500),
            evidence: z.string().trim().max(2000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(7),
    root_cause_summary: z.string().trim().max(2000).optional(),
    explanation: explanationField,
  })
  .strict();

const proposeFishboneCauseSchema = z
  .object({
    analysis_id: z.string().uuid().optional(),
    analysis_title: z.string().trim().min(1).max(200).optional(),
    label: z.string().trim().min(1).max(500),
    category: z.enum(HYPOTHESIS_CATEGORIES),
    parent_node_id: z.string().uuid().optional(),
    explanation: explanationField,
  })
  .strict();

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

function writeToolParameters(
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

export function getOpenAiToolParametersSchema(
  name: ProblemSolvingToolName,
): Record<string, unknown> {
  switch (name) {
    case "get_hypotheses":
      return hypothesisFilterParametersSchema;
    case "search_related_problem_solving_cases":
      return searchRelatedCasesParametersSchema;
    case "propose_problem_statement":
    case "propose_target_condition":
      return writeToolParameters(
        {
          statement: { type: "string" },
          explanation: { type: "string" },
        },
        ["statement", "explanation"],
      );
    case "propose_current_condition_item":
      return writeToolParameters(
        {
          category: { type: "string", enum: [...CURRENT_CONDITION_CATEGORIES] },
          statement: { type: "string" },
          explanation: { type: "string" },
        },
        ["category", "statement", "explanation"],
      );
    case "propose_hypothesis":
      return writeToolParameters(
        {
          statement: { type: "string" },
          category: {
            type: ["string", "null"],
            enum: [...HYPOTHESIS_CATEGORIES, null],
          },
          rationale: { type: ["string", "null"] },
          parent_hypothesis_id: { type: ["string", "null"] },
          explanation: { type: "string" },
        },
        [
          "statement",
          "category",
          "rationale",
          "parent_hypothesis_id",
          "explanation",
        ],
      );
    case "propose_containment":
      return writeToolParameters(
        {
          description: { type: "string" },
          rationale: { type: ["string", "null"] },
          explanation: { type: "string" },
        },
        ["description", "rationale", "explanation"],
      );
    case "propose_countermeasure":
      return writeToolParameters(
        {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          rationale: { type: ["string", "null"] },
          hypothesis_ids: {
            type: ["array", "null"],
            items: { type: "string" },
          },
          explanation: { type: "string" },
        },
        ["title", "description", "rationale", "hypothesis_ids", "explanation"],
      );
    case "propose_five_why_chain":
      return writeToolParameters(
        {
          title: { type: ["string", "null"] },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                evidence: { type: ["string", "null"] },
              },
              required: ["label", "evidence"],
              additionalProperties: false,
            },
            minItems: 1,
            maxItems: 7,
          },
          root_cause_summary: { type: ["string", "null"] },
          explanation: { type: "string" },
        },
        ["title", "steps", "root_cause_summary", "explanation"],
      );
    case "propose_fishbone_cause":
      return writeToolParameters(
        {
          analysis_id: { type: ["string", "null"] },
          analysis_title: { type: ["string", "null"] },
          label: { type: "string" },
          category: { type: "string", enum: [...HYPOTHESIS_CATEGORIES] },
          parent_node_id: { type: ["string", "null"] },
          explanation: { type: "string" },
        },
        [
          "analysis_id",
          "analysis_title",
          "label",
          "category",
          "parent_node_id",
          "explanation",
        ],
      );
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

function normalizeNullableWriteArgs(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (value === null) {
      delete next[key];
      continue;
    }
    if (key === "steps" && Array.isArray(value)) {
      next[key] = value.map((step) => {
        if (!step || typeof step !== "object") return step;
        const copy = { ...(step as Record<string, unknown>) };
        if (copy.evidence === null) {
          delete copy.evidence;
        }
        return copy;
      });
    }
  }
  return next;
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
    case "propose_problem_statement":
      return proposeProblemStatementSchema.parse(
        normalizeNullableWriteArgs(args),
      );
    case "propose_target_condition":
      return proposeTargetConditionSchema.parse(
        normalizeNullableWriteArgs(args),
      );
    case "propose_current_condition_item":
      return proposeCurrentConditionSchema.parse(
        normalizeNullableWriteArgs(args),
      );
    case "propose_hypothesis":
      return proposeHypothesisSchema.parse(normalizeNullableWriteArgs(args));
    case "propose_containment":
      return proposeContainmentSchema.parse(normalizeNullableWriteArgs(args));
    case "propose_countermeasure":
      return proposeCountermeasureSchema.parse(
        normalizeNullableWriteArgs(args),
      );
    case "propose_five_why_chain":
      return proposeFiveWhyChainSchema.parse(normalizeNullableWriteArgs(args));
    case "propose_fishbone_cause":
      return proposeFishboneCauseSchema.parse(normalizeNullableWriteArgs(args));
    default:
      return emptyToolArgsSchema.parse(args);
  }
}

const WRITE_TOOL_DESCRIPTIONS: Partial<
  Record<(typeof PROBLEM_SOLVING_WRITE_TOOLS)[number], string>
> = {
  propose_target_condition:
    "Queue draft target-condition wording for human approval on the current case. Describes the desired observable operational state—not the solution—and must not be treated as already achieved.",
};

function toolDescription(name: ProblemSolvingToolName): string {
  if ((PROBLEM_SOLVING_WRITE_TOOLS as readonly string[]).includes(name)) {
    const custom = WRITE_TOOL_DESCRIPTIONS[name as ProblemSolvingWriteToolName];
    if (custom) return custom;
    return `Queue a draft ${name.replace("propose_", "").replace(/_/g, " ")} proposal for human approval on the current case. Tool: ${name}`;
  }
  return `Read authorised problem-solving data for the current case. Tool: ${name}`;
}

export function buildOpenAiTools(): Array<Record<string, unknown>> {
  return PROBLEM_SOLVING_TOOLS.map((name) => ({
    type: "function",
    name,
    description: toolDescription(name),
    parameters: getOpenAiToolParametersSchema(name),
    strict: true,
  }));
}
