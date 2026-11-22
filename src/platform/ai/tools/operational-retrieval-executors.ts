import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseAuthorisedOperationalKnowledge,
  parseAuthorisedOperationalRecordContext,
} from "@/modules/leanai-retrieval/parse";
import type { OperationalKnowledgeDomain } from "@/modules/leanai-retrieval/types";
import { addToAllowlist } from "@/platform/ai/source-allowlist";
import type { SourceAllowlist } from "@/platform/ai/source-allowlist";
import {
  getOperationalRecordContextSchema,
  parseOperationalRetrievalToolArgs,
  searchOperationalKnowledgeSchema,
  type OperationalRetrievalToolName,
} from "@/platform/ai/tools/operational-retrieval-schemas";
import type { ToolExecutionResult, TypedSourceRef } from "@/platform/ai/types";

type OperationalRetrievalContext = {
  supabase: SupabaseClient;
  allowlist: SourceAllowlist;
};

function sourceRefForRecord(
  recordType: OperationalKnowledgeDomain,
  recordId: string,
): TypedSourceRef {
  switch (recordType) {
    case "problem_solving_case":
      return { problem_solving_case_id: recordId };
    case "action":
      return { action_id: recordId };
    default:
      return {};
  }
}

export async function executeOperationalRetrievalTool(
  ctx: OperationalRetrievalContext,
  toolName: OperationalRetrievalToolName,
  rawArgs: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const sourceRefsAdded: TypedSourceRef[] = [];

  try {
    switch (toolName) {
      case "search_operational_knowledge": {
        const args = parseOperationalRetrievalToolArgs(
          toolName,
          rawArgs,
        ) as ReturnType<typeof searchOperationalKnowledgeSchema.parse>;
        const { data, error } = await ctx.supabase.rpc(
          "search_authorised_operational_knowledge",
          {
            target_query: args.query,
            target_limit: args.limit ?? 8,
            target_domains: args.domains ?? null,
          },
        );
        if (error) {
          return {
            status: "failed",
            resultMetadata: { error: "operational_knowledge_unavailable" },
            sourceRefsAdded,
          };
        }
        const matches = parseAuthorisedOperationalKnowledge(data);
        for (const match of matches) {
          const ref = sourceRefForRecord(match.recordType, match.recordId);
          if (Object.keys(ref).length > 0) {
            addToAllowlist(ctx.allowlist, ref);
            sourceRefsAdded.push(ref);
          }
        }
        return {
          status: "succeeded",
          resultMetadata: {
            matches,
            citations: matches.map((match) => ({
              record_id: match.recordId,
              record_type: match.recordType,
              title: match.title,
              href: match.href,
              content_trust: match.contentTrust,
            })),
          },
          sourceRefsAdded,
        };
      }
      case "get_operational_record_context": {
        const args = parseOperationalRetrievalToolArgs(
          toolName,
          rawArgs,
        ) as ReturnType<typeof getOperationalRecordContextSchema.parse>;
        const { data, error } = await ctx.supabase.rpc(
          "get_authorised_operational_record_context",
          {
            target_record_type: args.record_type,
            target_record_id: args.record_id,
          },
        );
        if (error) {
          return {
            status: "failed",
            resultMetadata: { error: "operational_record_unavailable" },
            sourceRefsAdded,
          };
        }
        const context = parseAuthorisedOperationalRecordContext(data);
        if (!context) {
          return {
            status: "failed",
            resultMetadata: { error: "operational_record_parse_failed" },
            sourceRefsAdded,
          };
        }
        const ref = sourceRefForRecord(context.recordType, context.recordId);
        if (Object.keys(ref).length > 0) {
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { record: context },
          sourceRefsAdded,
        };
      }
      default:
        return {
          status: "denied",
          resultMetadata: {},
          denialReason: "unknown_tool",
          sourceRefsAdded,
        };
    }
  } catch {
    return {
      status: "failed",
      resultMetadata: { error: "operational_retrieval_tool_failed" },
      sourceRefsAdded,
    };
  }
}
