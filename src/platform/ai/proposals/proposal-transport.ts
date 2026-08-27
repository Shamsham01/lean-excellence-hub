import type { AiProposalType } from "@/platform/ai/types";
import { CURRENT_CONDITION_CATEGORIES } from "@/lib/problem-solving/types";
import {
  safeValidateProposalPayload,
  sanitizeEnvelopeProposals,
} from "@/platform/ai/proposals/contracts";

const nullableString = { type: ["string", "null"] } as const;
const explanationField = { type: "string" } as const;
const uuidStringArray = {
  type: "array",
  items: { type: "string" },
} as const;

const currentConditionItemTransportItemSchema = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: [...CURRENT_CONDITION_CATEGORIES],
    },
    statement: { type: "string" },
    explanation: explanationField,
  },
  required: ["category", "statement", "explanation"],
  additionalProperties: false,
} as const;

const hypothesisTransportItemSchema = {
  type: "object",
  properties: {
    statement: { type: "string" },
    category: nullableString,
    rationale: nullableString,
    parent_hypothesis_id: nullableString,
    explanation: explanationField,
  },
  required: [
    "statement",
    "category",
    "rationale",
    "parent_hypothesis_id",
    "explanation",
  ],
  additionalProperties: false,
} as const;

const hypothesisTestTransportItemSchema = {
  type: "object",
  properties: {
    hypothesis_id: { type: "string" },
    test_question: { type: "string" },
    expected_result: { type: "string" },
    method: nullableString,
    explanation: explanationField,
  },
  required: [
    "hypothesis_id",
    "test_question",
    "expected_result",
    "method",
    "explanation",
  ],
  additionalProperties: false,
} as const;

const containmentTransportItemSchema = {
  type: "object",
  properties: {
    description: { type: "string" },
    rationale: nullableString,
    explanation: explanationField,
  },
  required: ["description", "rationale", "explanation"],
  additionalProperties: false,
} as const;

const countermeasureTransportItemSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: nullableString,
    rationale: nullableString,
    hypothesis_ids: uuidStringArray,
    explanation: explanationField,
  },
  required: [
    "title",
    "description",
    "rationale",
    "hypothesis_ids",
    "explanation",
  ],
  additionalProperties: false,
} as const;

const universalActionTransportItemSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: nullableString,
    context_role: {
      type: "string",
      enum: ["containment", "countermeasure", "sustainment"],
    },
    explanation: explanationField,
  },
  required: ["title", "description", "context_role", "explanation"],
  additionalProperties: false,
} as const;

const effectivenessCheckTransportItemSchema = {
  type: "object",
  properties: {
    criterion: { type: "string" },
    baseline_description: nullableString,
    target_description: nullableString,
    explanation: explanationField,
  },
  required: [
    "criterion",
    "baseline_description",
    "target_description",
    "explanation",
  ],
  additionalProperties: false,
} as const;

const sustainmentItemTransportItemSchema = {
  type: "object",
  properties: {
    what: { type: "string" },
    check_method: nullableString,
    explanation: explanationField,
  },
  required: ["what", "check_method", "explanation"],
  additionalProperties: false,
} as const;

const sessionQuestionTransportItemSchema = {
  type: "object",
  properties: {
    session_id: { type: "string" },
    body: { type: "string" },
    explanation: explanationField,
  },
  required: ["session_id", "body", "explanation"],
  additionalProperties: false,
} as const;

const sessionSummaryTransportItemSchema = {
  type: "object",
  properties: {
    session_id: { type: "string" },
    body: { type: "string" },
    explanation: explanationField,
  },
  required: ["session_id", "body", "explanation"],
  additionalProperties: false,
} as const;

const lessonsLearnedTransportItemSchema = {
  type: "object",
  properties: {
    what_happened: { type: "string" },
    what_learned: { type: "string" },
    standardise: nullableString,
    apply_elsewhere: nullableString,
    notes: nullableString,
    explanation: explanationField,
  },
  required: [
    "what_happened",
    "what_learned",
    "standardise",
    "apply_elsewhere",
    "notes",
    "explanation",
  ],
  additionalProperties: false,
} as const;

export const proposalsTransportJsonSchema = {
  type: "object",
  properties: {
    current_condition_items: {
      type: "array",
      items: currentConditionItemTransportItemSchema,
    },
    hypotheses: {
      type: "array",
      items: hypothesisTransportItemSchema,
    },
    hypothesis_tests: {
      type: "array",
      items: hypothesisTestTransportItemSchema,
    },
    containments: {
      type: "array",
      items: containmentTransportItemSchema,
    },
    countermeasures: {
      type: "array",
      items: countermeasureTransportItemSchema,
    },
    universal_actions: {
      type: "array",
      items: universalActionTransportItemSchema,
    },
    effectiveness_checks: {
      type: "array",
      items: effectivenessCheckTransportItemSchema,
    },
    sustainment_items: {
      type: "array",
      items: sustainmentItemTransportItemSchema,
    },
    session_questions: {
      type: "array",
      items: sessionQuestionTransportItemSchema,
    },
    session_summaries: {
      type: "array",
      items: sessionSummaryTransportItemSchema,
    },
    lessons_learned: {
      type: "array",
      items: lessonsLearnedTransportItemSchema,
    },
  },
  required: [
    "current_condition_items",
    "hypotheses",
    "hypothesis_tests",
    "containments",
    "countermeasures",
    "universal_actions",
    "effectiveness_checks",
    "sustainment_items",
    "session_questions",
    "session_summaries",
    "lessons_learned",
  ],
  additionalProperties: false,
} as const;

export type OpenAiProposalsTransport = {
  current_condition_items: Array<{
    category: string;
    statement: string;
    explanation: string;
  }>;
  hypotheses: Array<{
    statement: string;
    category: string | null;
    rationale: string | null;
    parent_hypothesis_id: string | null;
    explanation: string;
  }>;
  hypothesis_tests: Array<{
    hypothesis_id: string;
    test_question: string;
    expected_result: string;
    method: string | null;
    explanation: string;
  }>;
  containments: Array<{
    description: string;
    rationale: string | null;
    explanation: string;
  }>;
  countermeasures: Array<{
    title: string;
    description: string | null;
    rationale: string | null;
    hypothesis_ids: string[];
    explanation: string;
  }>;
  universal_actions: Array<{
    title: string;
    description: string | null;
    context_role: "containment" | "countermeasure" | "sustainment";
    explanation: string;
  }>;
  effectiveness_checks: Array<{
    criterion: string;
    baseline_description: string | null;
    target_description: string | null;
    explanation: string;
  }>;
  sustainment_items: Array<{
    what: string;
    check_method: string | null;
    explanation: string;
  }>;
  session_questions: Array<{
    session_id: string;
    body: string;
    explanation: string;
  }>;
  session_summaries: Array<{
    session_id: string;
    body: string;
    explanation: string;
  }>;
  lessons_learned: Array<{
    what_happened: string;
    what_learned: string;
    standardise: string | null;
    apply_elsewhere: string | null;
    notes: string | null;
    explanation: string;
  }>;
};

const emptyProposalsTransport = (): OpenAiProposalsTransport => ({
  current_condition_items: [],
  hypotheses: [],
  hypothesis_tests: [],
  containments: [],
  countermeasures: [],
  universal_actions: [],
  effectiveness_checks: [],
  sustainment_items: [],
  session_questions: [],
  session_summaries: [],
  lessons_learned: [],
});

const PROPOSAL_BUCKET_MAPPINGS: Array<{
  bucket: keyof OpenAiProposalsTransport;
  proposalType: AiProposalType;
}> = [
  { bucket: "current_condition_items", proposalType: "current_condition_item" },
  { bucket: "hypotheses", proposalType: "hypothesis" },
  { bucket: "hypothesis_tests", proposalType: "hypothesis_test" },
  { bucket: "containments", proposalType: "containment" },
  { bucket: "countermeasures", proposalType: "countermeasure" },
  { bucket: "universal_actions", proposalType: "universal_action" },
  { bucket: "effectiveness_checks", proposalType: "effectiveness_check" },
  { bucket: "sustainment_items", proposalType: "sustainment_item" },
  { bucket: "session_questions", proposalType: "session_question" },
  { bucket: "session_summaries", proposalType: "session_summary" },
  { bucket: "lessons_learned", proposalType: "lessons_learned" },
];

function normalizeTransportPayloadFields(
  payloadFields: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payloadFields)) {
    if (value === null) {
      continue;
    }
    if (
      key === "hypothesis_ids" &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

export function flattenValidatedProposalsFromTransport(
  transport: OpenAiProposalsTransport,
): Array<{
  proposal_type: AiProposalType;
  payload: Record<string, unknown>;
  explanation: string;
}> {
  const proposals: Array<{
    proposal_type: AiProposalType;
    payload: Record<string, unknown>;
    explanation: string;
  }> = [];

  for (const mapping of PROPOSAL_BUCKET_MAPPINGS) {
    for (const item of transport[mapping.bucket]) {
      const { explanation, ...payloadFields } = item as Record<
        string,
        unknown
      > & {
        explanation: string;
      };
      const normalizedPayload = normalizeTransportPayloadFields(payloadFields);
      const validation = safeValidateProposalPayload(
        mapping.proposalType,
        normalizedPayload,
      );

      if (!validation.success) {
        continue;
      }

      proposals.push({
        proposal_type: mapping.proposalType,
        payload: validation.data as Record<string, unknown>,
        explanation,
      });
    }
  }

  return proposals;
}

export function createEmptyProposalsTransport(): OpenAiProposalsTransport {
  return emptyProposalsTransport();
}

export function normalizeProposalsTransport(
  transport: OpenAiProposalsTransport | null | undefined,
): Array<{
  proposal_type: AiProposalType;
  payload: Record<string, unknown>;
  explanation: string;
}> {
  const buckets = transport ?? emptyProposalsTransport();
  return flattenValidatedProposalsFromTransport(buckets);
}

export { sanitizeEnvelopeProposals };
