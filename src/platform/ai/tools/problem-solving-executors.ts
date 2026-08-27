import type { SupabaseClient } from "@supabase/supabase-js";

import { addToAllowlist } from "@/platform/ai/source-allowlist";
import type { ProblemSolvingToolName } from "@/platform/ai/tools/problem-solving-schemas";
import { parseToolArgs } from "@/platform/ai/tools/problem-solving-schemas";
import type { ToolExecutionResult, TypedSourceRef } from "@/platform/ai/types";
import type { SourceAllowlist } from "@/platform/ai/source-allowlist";

type CaseDetail = Record<string, unknown>;

type ToolContext = {
  supabase: SupabaseClient;
  caseId: string;
  allowlist: SourceAllowlist;
};

async function loadCaseDetail(ctx: ToolContext): Promise<CaseDetail> {
  const { data, error } = await ctx.supabase.rpc("get_problem_solving_detail", {
    target_case_id: ctx.caseId,
  });
  if (error) throw error;
  return (data ?? {}) as CaseDetail;
}

function seedCaseRef(ctx: ToolContext): TypedSourceRef {
  const ref = { problem_solving_case_id: ctx.caseId };
  addToAllowlist(ctx.allowlist, ref);
  return ref;
}

export async function executeProblemSolvingTool(
  ctx: ToolContext,
  toolName: ProblemSolvingToolName,
  rawArgs: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const args = parseToolArgs(toolName, rawArgs);
  const sourceRefsAdded: TypedSourceRef[] = [];

  try {
    switch (toolName) {
      case "get_problem_solving_case_overview": {
        const detail = await loadCaseDetail(ctx);
        seedCaseRef(ctx);
        return {
          status: "succeeded",
          resultMetadata: {
            title: detail.title,
            status: detail.status,
            problem_statement: detail.problem_statement,
            current_method_stage_id: detail.current_method_stage_id,
            stage_key: detail.current_stage_key,
          },
          sourceRefsAdded: [{ problem_solving_case_id: ctx.caseId }],
        };
      }
      case "get_current_condition": {
        const { data: items, error } = await ctx.supabase
          .from("problem_solving_current_condition_items")
          .select("id, category, statement, status, created_at")
          .eq("case_id", ctx.caseId)
          .order("created_at")
          .limit(50);
        if (error) throw error;
        const rows = items ?? [];
        for (const item of rows) {
          const ref = { current_condition_item_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { items: rows },
          sourceRefsAdded,
        };
      }
      case "get_hypotheses": {
        const detail = await loadCaseDetail(ctx);
        let items = (detail.hypotheses as Array<Record<string, unknown>>) ?? [];
        if (args.status) {
          items = items.filter((h) => h.status === args.status);
        }
        for (const item of items.slice(0, 50)) {
          const ref = { hypothesis_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { hypotheses: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "get_hypothesis_tests": {
        const detail = await loadCaseDetail(ctx);
        const items =
          (detail.hypothesis_tests as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { hypothesis_test_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { tests: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "get_containments": {
        const { data: items, error } = await ctx.supabase
          .from("problem_solving_containments")
          .select("id, description, status, rationale, created_at")
          .eq("problem_solving_case_id", ctx.caseId)
          .order("created_at")
          .limit(50);
        if (error) throw error;
        const rows = items ?? [];
        for (const item of rows) {
          const ref = { containment_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { containments: rows },
          sourceRefsAdded,
        };
      }
      case "get_countermeasures": {
        const detail = await loadCaseDetail(ctx);
        const items =
          (detail.countermeasures as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { countermeasure_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { countermeasures: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "get_cause_analysis": {
        const detail = await loadCaseDetail(ctx);
        return {
          status: "succeeded",
          resultMetadata: {
            analyses: (detail.analyses as unknown[]) ?? [],
            analysis_nodes: (detail.analysis_nodes as unknown[]) ?? [],
          },
          sourceRefsAdded: [],
        };
      }
      case "get_case_actions": {
        const detail = await loadCaseDetail(ctx);
        const items = (detail.actions as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { action_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { actions: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "get_effectiveness_checks": {
        const detail = await loadCaseDetail(ctx);
        const items =
          (detail.effectiveness_checks as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { effectiveness_check_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { effectiveness_checks: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "get_sustainment": {
        const detail = await loadCaseDetail(ctx);
        const items =
          (detail.sustainment_items as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { sustainment_item_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: {
            sustainment_items: items.slice(0, 50),
            lessons_learned: detail.lessons_learned ?? [],
          },
          sourceRefsAdded,
        };
      }
      case "get_lessons_learned": {
        const detail = await loadCaseDetail(ctx);
        const items =
          (detail.lessons_learned as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { lesson_learned_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { lessons_learned: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "get_problem_solving_sessions": {
        const detail = await loadCaseDetail(ctx);
        const items = (detail.sessions as Array<Record<string, unknown>>) ?? [];
        for (const item of items.slice(0, 50)) {
          const ref = { problem_solving_session_id: String(item.id) };
          addToAllowlist(ctx.allowlist, ref);
          sourceRefsAdded.push(ref);
        }
        return {
          status: "succeeded",
          resultMetadata: { sessions: items.slice(0, 50) },
          sourceRefsAdded,
        };
      }
      case "search_related_problem_solving_cases": {
        const limit = (args.limit as number | undefined) ?? 5;
        const { data, error } = await ctx.supabase.rpc(
          "search_similar_problem_solving_cases",
          {
            target_case_id: ctx.caseId,
            target_limit: limit,
          },
        );
        if (error) throw error;
        const cases = Array.isArray(data) ? data : [];
        for (const item of cases) {
          if (item.case_id) {
            const ref = { problem_solving_case_id: String(item.case_id) };
            addToAllowlist(ctx.allowlist, ref);
            sourceRefsAdded.push(ref);
          }
        }
        return {
          status: "succeeded",
          resultMetadata: { related_cases: cases },
          sourceRefsAdded,
        };
      }
      default:
        return {
          status: "denied",
          resultMetadata: {},
          denialReason: "unknown_tool",
          sourceRefsAdded: [],
        };
    }
  } catch (error) {
    return {
      status: "failed",
      resultMetadata: {
        error: error instanceof Error ? error.message : "tool_failed",
      },
      sourceRefsAdded: [],
    };
  }
}
