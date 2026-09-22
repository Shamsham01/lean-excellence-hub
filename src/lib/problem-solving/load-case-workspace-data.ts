import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveProblemSolvingListResult,
  resolveProblemSolvingLoadError,
} from "@/lib/problem-solving/resolve-supabase-load";
import {
  callProblemSolvingRpc,
  untypedFrom,
} from "@/lib/problem-solving/supabase-untyped";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
  ProblemSolvingCaseDetail,
  ProblemSolvingContainment,
  ProblemSolvingCurrentConditionItem,
  ProblemSolvingHypothesisTest,
  ProblemSolvingMethodsResponse,
} from "@/lib/problem-solving/types";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { resolveMembershipNameById } from "@/lib/identity/membership-display-label";
import type { MethodStage } from "@/lib/problem-solving/stages";
import type { Database } from "@/platform/supabase/database.types";

export type CaseWorkspaceData = {
  currentConditionItems: ProblemSolvingCurrentConditionItem[];
  containments: ProblemSolvingContainment[];
  analyses: ProblemSolvingAnalysis[];
  analysisNodes: ProblemSolvingAnalysisNode[];
  hypothesisTests: ProblemSolvingHypothesisTest[];
  methodStages: MethodStage[];
  methods: ProblemSolvingMethodsResponse["items"];
  comments: CommentRow[];
  evidence: EvidenceItem[];
  membershipNameById: Record<string, string>;
};

export function collectMembershipIds(
  detail: ProblemSolvingCaseDetail,
): string[] {
  return [
    ...new Set([
      detail.owner_membership_id,
      detail.facilitator_membership_id,
      detail.created_by_membership_id,
      detail.closed_by_membership_id,
      detail.cancelled_by_membership_id,
      ...detail.status_history.map((entry) => entry.changed_by_membership_id),
      ...detail.stage_history.map((entry) => entry.changed_by_membership_id),
      ...detail.hypotheses.flatMap((row) => [
        row.created_by_membership_id,
        row.verified_by_membership_id,
        row.rejected_by_membership_id,
      ]),
      ...detail.countermeasures.flatMap((row) => [
        row.proposed_by_membership_id,
        row.selected_by_membership_id,
        row.rejected_by_membership_id,
      ]),
      ...detail.sustainment_items.flatMap((row) => [
        row.owner_membership_id,
        row.created_by_membership_id,
      ]),
      ...detail.sessions.flatMap((row) => [
        row.facilitator_membership_id,
        ...row.participants.map((participant) => participant.membership_id),
      ]),
    ]),
  ].filter((id): id is string => Boolean(id));
}

async function resolveProblemSolvingMethodsResult(result: {
  data: ProblemSolvingMethodsResponse | null;
  error: unknown;
}): Promise<ProblemSolvingMethodsResponse["items"]> {
  if (result.error) {
    await resolveProblemSolvingLoadError(
      result.error,
      "get_problem_solving_methods",
    );
  }

  return result.data?.items ?? [];
}

export async function loadCaseWorkspaceData(
  supabase: SupabaseClient<Database>,
  caseId: string,
  detail: ProblemSolvingCaseDetail,
): Promise<CaseWorkspaceData> {
  const attachmentIds = [
    ...new Set(detail.evidence_links.map((row) => row.attachment_id)),
  ];
  const membershipIds = collectMembershipIds(detail);
  const hypothesisIds = detail.hypotheses.map((row) => row.id);

  const [
    currentConditionResult,
    containmentResult,
    analysisResult,
    methodsResult,
    commentsResult,
    methodStagesResult,
  ] = await Promise.all([
    untypedFrom(supabase, "problem_solving_current_condition_items")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at"),
    untypedFrom(supabase, "problem_solving_containments")
      .select("*")
      .eq("problem_solving_case_id", caseId)
      .order("created_at"),
    untypedFrom(supabase, "problem_solving_analyses")
      .select("*")
      .eq("problem_solving_case_id", caseId)
      .order("created_at"),
    callProblemSolvingRpc<ProblemSolvingMethodsResponse>(
      supabase,
      "get_problem_solving_methods",
    ),
    supabase
      .from("comments")
      .select("id, body, created_at, author_membership_id")
      .eq("target_resource_id", caseId)
      .order("created_at"),
    detail.method_version_id
      ? untypedFrom(supabase, "problem_solving_method_stages")
          .select("id, title, semantic_stage_key, description, display_order")
          .eq("method_version_id", detail.method_version_id)
          .order("display_order")
      : Promise.resolve({ data: null, error: null }),
  ]);

  const [
    currentConditionItems,
    containments,
    analyses,
    methods,
    comments,
    methodStages,
  ] = await Promise.all([
    resolveProblemSolvingListResult<ProblemSolvingCurrentConditionItem>(
      currentConditionResult,
      "problem_solving_current_condition_items",
    ),
    resolveProblemSolvingListResult<ProblemSolvingContainment>(
      containmentResult,
      "problem_solving_containments",
    ),
    resolveProblemSolvingListResult<ProblemSolvingAnalysis>(
      analysisResult,
      "problem_solving_analyses",
    ),
    resolveProblemSolvingMethodsResult(methodsResult),
    resolveProblemSolvingListResult<CommentRow>(commentsResult, "comments"),
    resolveProblemSolvingListResult<MethodStage>(
      methodStagesResult,
      "problem_solving_method_stages",
    ),
  ]);

  const analysisIds = analyses.map((row) => row.id);

  const [analysisNodesResult, hypothesisTestsResult, attachmentsResult] =
    await Promise.all([
      analysisIds.length > 0
        ? untypedFrom(supabase, "problem_solving_analysis_nodes")
            .select("*")
            .in("analysis_id", analysisIds)
            .order("sort_order")
        : Promise.resolve({ data: [], error: null }),
      hypothesisIds.length > 0
        ? untypedFrom(supabase, "problem_solving_hypothesis_tests")
            .select("*")
            .in("hypothesis_id", hypothesisIds)
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
      attachmentIds.length > 0
        ? supabase
            .from("attachments")
            .select("id, filename, mime_type, byte_size")
            .in("id", attachmentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const [analysisNodes, hypothesisTests, attachmentRows] = await Promise.all([
    resolveProblemSolvingListResult<ProblemSolvingAnalysisNode>(
      analysisNodesResult,
      "problem_solving_analysis_nodes",
    ),
    resolveProblemSolvingListResult<ProblemSolvingHypothesisTest>(
      hypothesisTestsResult,
      "problem_solving_hypothesis_tests",
    ),
    resolveProblemSolvingListResult<{
      id: string;
      filename: string;
      mime_type: string;
      byte_size: number | null;
    }>(attachmentsResult, "attachments"),
  ]);

  const membershipNameById = resolveMembershipNameById({
    membershipIds,
    authorisedLabels: {
      ...(detail.membership_display_names ?? {}),
      [detail.owner_membership_id]:
        detail.owner_display_name ??
        detail.membership_display_names?.[detail.owner_membership_id],
      ...(detail.facilitator_membership_id
        ? {
            [detail.facilitator_membership_id]:
              detail.facilitator_display_name ??
              detail.membership_display_names?.[
                detail.facilitator_membership_id
              ],
          }
        : {}),
    },
  });

  const evidence = attachmentRows
    .filter((row) => row.byte_size != null)
    .map((row) => ({
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      byte_size: row.byte_size as number,
    }));

  return {
    currentConditionItems,
    containments,
    analyses,
    analysisNodes,
    hypothesisTests,
    methodStages,
    methods,
    comments,
    evidence,
    membershipNameById,
  };
}
