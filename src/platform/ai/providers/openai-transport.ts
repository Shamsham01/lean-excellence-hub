import type {
  AiProposalType,
  FacilitatorEnvelope,
  SourceRefKey,
  SupportLevel,
  TypedSourceRef,
} from "@/platform/ai/types";
import {
  AI_PROPOSAL_TYPES,
  FORBIDDEN_PROPOSAL_TYPES,
  SOURCE_REF_KEYS,
  SUPPORT_LEVELS,
} from "@/platform/ai/types";

export type OpenAiFacilitatorEnvelopeTransport = {
  message: string;
  observations: Array<{ text: string; support_level: SupportLevel }>;
  questions: string[];
  warnings: string[];
  source_refs: Array<{
    label: string;
    ref_type: SourceRefKey;
    ref_id: string;
  }>;
  proposals: Array<{
    proposal_type: string;
    payload_json: string;
    explanation: string;
  }>;
};

export const facilitatorEnvelopeJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          support_level: {
            type: "string",
            enum: [...SUPPORT_LEVELS],
          },
        },
        required: ["text", "support_level"],
        additionalProperties: false,
      },
    },
    questions: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    source_refs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          ref_type: {
            type: "string",
            enum: [...SOURCE_REF_KEYS],
          },
          ref_id: { type: "string" },
        },
        required: ["label", "ref_type", "ref_id"],
        additionalProperties: false,
      },
    },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          proposal_type: {
            type: "string",
            enum: [...AI_PROPOSAL_TYPES],
          },
          payload_json: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["proposal_type", "payload_json", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "message",
    "observations",
    "questions",
    "warnings",
    "source_refs",
    "proposals",
  ],
  additionalProperties: false,
} as const;

const forbiddenProposalTypeSet = new Set<string>(FORBIDDEN_PROPOSAL_TYPES);
const allowedProposalTypeSet = new Set<string>(AI_PROPOSAL_TYPES);
const allowedSourceRefKeySet = new Set<string>(SOURCE_REF_KEYS);

export function isAllowedProposalType(
  proposalType: string,
): proposalType is AiProposalType {
  return (
    allowedProposalTypeSet.has(proposalType) &&
    !forbiddenProposalTypeSet.has(proposalType)
  );
}

function parseProposalPayload(
  payloadJson: string,
): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
}

export function normalizeTransportEnvelope(
  transport: OpenAiFacilitatorEnvelopeTransport,
): FacilitatorEnvelope {
  const proposals: FacilitatorEnvelope["proposals"] = [];

  for (const proposal of transport.proposals) {
    if (!isAllowedProposalType(proposal.proposal_type)) {
      continue;
    }

    const payload = parseProposalPayload(proposal.payload_json);
    if (!payload) {
      continue;
    }

    proposals.push({
      proposal_type: proposal.proposal_type,
      payload,
      explanation: proposal.explanation,
    });
  }

  return {
    message: transport.message,
    observations: transport.observations.map((observation) => ({
      text: observation.text,
      support_level: observation.support_level,
    })),
    questions: transport.questions,
    warnings: transport.warnings,
    source_refs: transport.source_refs
      .filter((sourceRef) => allowedSourceRefKeySet.has(sourceRef.ref_type))
      .map((sourceRef) => ({
        label: sourceRef.label,
        ref: { [sourceRef.ref_type]: sourceRef.ref_id } as TypedSourceRef,
      })),
    proposals,
  };
}

type JsonSchemaNode = Record<string, unknown>;

export function assertStrictJsonSchemaCompatible(
  schema: unknown,
  path = "root",
): void {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`${path}: schema node must be an object`);
  }

  const node = schema as JsonSchemaNode;

  if (node.type === "object") {
    const properties = node.properties;
    if (
      !properties ||
      typeof properties !== "object" ||
      Array.isArray(properties)
    ) {
      throw new Error(`${path}: object schema must declare properties`);
    }

    const propertyKeys = Object.keys(properties);
    const required = node.required;
    if (!Array.isArray(required)) {
      throw new Error(
        `${path}: object schema must declare required as an array`,
      );
    }

    for (const key of propertyKeys) {
      if (!required.includes(key)) {
        throw new Error(
          `${path}: required must include every property key; missing "${key}"`,
        );
      }
    }

    if (node.additionalProperties !== false) {
      throw new Error(
        `${path}: additionalProperties must be false for strict schemas`,
      );
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      assertStrictJsonSchemaCompatible(
        childSchema,
        `${path}.properties.${key}`,
      );
    }
  }

  if (node.type === "array" && node.items) {
    assertStrictJsonSchemaCompatible(node.items, `${path}.items`);
  }
}
