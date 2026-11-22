import { z } from "zod";

import { OPERATIONAL_KNOWLEDGE_DOMAINS } from "@/modules/leanai-retrieval/types";

export const OPERATIONAL_RETRIEVAL_READ_TOOLS = [
  "search_operational_knowledge",
  "get_operational_record_context",
] as const;

export type OperationalRetrievalToolName =
  (typeof OPERATIONAL_RETRIEVAL_READ_TOOLS)[number];

const domainSchema = z.enum(OPERATIONAL_KNOWLEDGE_DOMAINS);

export const searchOperationalKnowledgeSchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    limit: z.number().int().min(1).max(12).optional(),
    domains: z.array(domainSchema).max(10).optional(),
  })
  .strict();

export const getOperationalRecordContextSchema = z
  .object({
    record_type: domainSchema,
    record_id: z.string().uuid(),
  })
  .strict();

export const searchOperationalKnowledgeParametersSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description:
        "English keywords describing the operational topic to search for.",
    },
    limit: {
      type: ["integer", "null"],
      minimum: 1,
      maximum: 12,
      description: "Maximum number of records to return (default 8).",
    },
    domains: {
      type: ["array", "null"],
      items: { type: "string", enum: [...OPERATIONAL_KNOWLEDGE_DOMAINS] },
      description:
        "Optional allowlisted domains. Omit to search all operational modules.",
    },
  },
  required: ["query", "limit", "domains"],
  additionalProperties: false,
} as const;

export const getOperationalRecordContextParametersSchema = {
  type: "object",
  properties: {
    record_type: {
      type: "string",
      enum: [...OPERATIONAL_KNOWLEDGE_DOMAINS],
    },
    record_id: {
      type: "string",
      description: "UUID of the operational record.",
    },
  },
  required: ["record_type", "record_id"],
  additionalProperties: false,
} as const;

function normalizeOperationalRetrievalTransportArgs(
  toolName: OperationalRetrievalToolName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  switch (toolName) {
    case "search_operational_knowledge": {
      const next = { ...raw };
      if (next.limit === null || next.limit === undefined) {
        delete next.limit;
      }
      if (next.domains === null || next.domains === undefined) {
        delete next.domains;
      }
      return next;
    }
    default:
      return raw;
  }
}

export function parseOperationalRetrievalToolArgs(
  toolName: OperationalRetrievalToolName,
  raw: Record<string, unknown>,
) {
  const args = normalizeOperationalRetrievalTransportArgs(toolName, raw);

  switch (toolName) {
    case "search_operational_knowledge":
      return searchOperationalKnowledgeSchema.parse(args);
    case "get_operational_record_context":
      return getOperationalRecordContextSchema.parse(args);
    default:
      throw new Error(`Unknown operational retrieval tool: ${toolName}`);
  }
}

function getOpenAiToolParametersSchema(
  name: OperationalRetrievalToolName,
): Record<string, unknown> {
  switch (name) {
    case "search_operational_knowledge":
      return searchOperationalKnowledgeParametersSchema;
    case "get_operational_record_context":
      return getOperationalRecordContextParametersSchema;
    default:
      return {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      };
  }
}

export function buildOperationalRetrievalOpenAiTools(): Array<
  Record<string, unknown>
> {
  return OPERATIONAL_RETRIEVAL_READ_TOOLS.map((name) => ({
    type: "function",
    name,
    description: toolDescription(name),
    parameters: getOpenAiToolParametersSchema(name),
    strict: true,
  }));
}

function toolDescription(name: OperationalRetrievalToolName): string {
  switch (name) {
    case "search_operational_knowledge":
      return "Search authorised operational records across LEH modules. Returns only records the signed-in member can read. Empty means no accessible match—not hidden records.";
    case "get_operational_record_context":
      return "Fetch a bounded excerpt for one operational record after re-checking read permission. Use after search when more detail is needed.";
    default:
      return "";
  }
}

export function isOperationalRetrievalTool(
  name: string,
): name is OperationalRetrievalToolName {
  return (OPERATIONAL_RETRIEVAL_READ_TOOLS as readonly string[]).includes(name);
}
