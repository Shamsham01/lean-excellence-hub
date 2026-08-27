import Link from "next/link";
import { notFound } from "next/navigation";

import { CaseWorkspace } from "@/components/problem-solving/case-workspace";
import { callProblemSolvingRpc, untypedFrom } from "@/lib/problem-solving/supabase-untyped";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
  ProblemSolvingCaseDetail,
  ProblemSolvingContainment,
  ProblemSolvingCurrentConditionItem,
  ProblemSolvingHypothesisTest,
  ProblemSolvingMethodsResponse,
} from "@/lib/problem-solving/types";
import type { MethodStage } from "@/lib/problem-solving/stages";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProblemSolvingCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const canView = await currentMemberHasPermission("problem_solving.view");
  if (!canView) notFound();

  const supabase = await createServerSupabaseClient();

  const { data: detail, error } = await callProblemSolvingRpc<ProblemSolvingCaseDetail>(
    supabase,
    "get_problem_solving_detail",
    { target_case_id: caseId },
  );

  if (error || !detail) notFound();

  const canManage = await currentMemberHasPermission("problem_solving.manage");
  const canContribute = await currentMemberHasPermission("problem_solving.contribute");
  const canFacilitate = await currentMemberHasPermission("problem_solving.facilitate");
  const canVerifyCause = await currentMemberHasPermission("problem_solving.verify_cause");
  const canClose = await currentMemberHasPermission("problem_solving.close");

  const { data: currentConditionRows } = await untypedFrom(
    supabase,
    "problem_solving_current_condition_items",
  )
    .select("*")
    .eq("case_id", caseId)
    .order("created_at");

  const { data: containmentRows } = await untypedFrom(supabase, "problem_solving_containments")
    .select("*")
    .eq("problem_solving_case_id", caseId)
    .order("created_at");

  const { data: analysisRows } = await untypedFrom(supabase, "problem_solving_analyses")
    .select("*")
    .eq("problem_solving_case_id", caseId)
    .order("created_at");

  const analysisIds = (analysisRows as ProblemSolvingAnalysis[] | null)?.map((row) => row.id) ?? [];
  let analysisNodes: ProblemSolvingAnalysisNode[] = [];
  if (analysisIds.length > 0) {
    const { data: nodeRows } = await untypedFrom(supabase, "problem_solving_analysis_nodes")
      .select("*")
      .in("analysis_id", analysisIds)
      .order("sort_order");
    analysisNodes = (nodeRows as ProblemSolvingAnalysisNode[] | null) ?? [];
  }

  const hypothesisIds = detail.hypotheses.map((row) => row.id);
  let hypothesisTests: ProblemSolvingHypothesisTest[] = [];
  if (hypothesisIds.length > 0) {
    const { data: testRows } = await untypedFrom(supabase, "problem_solving_hypothesis_tests")
      .select("*")
      .in("hypothesis_id", hypothesisIds)
      .order("created_at");
    hypothesisTests = (testRows as ProblemSolvingHypothesisTest[] | null) ?? [];
  }

  let methodStages: MethodStage[] = [];
  if (detail.method_version_id) {
    const { data: stageRows } = await untypedFrom(supabase, "problem_solving_method_stages")
      .select("id, title, semantic_stage_key, description, display_order")
      .eq("method_version_id", detail.method_version_id)
      .order("display_order");
    methodStages = (stageRows as MethodStage[] | null) ?? [];
  }

  const { data: methodsData } = await callProblemSolvingRpc<ProblemSolvingMethodsResponse>(
    supabase,
    "get_problem_solving_methods",
  );

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_membership_id")
    .eq("target_resource_id", caseId)
    .order("created_at");

  const attachmentIds = [
    ...new Set(detail.evidence_links.map((row) => row.attachment_id)),
  ];

  let evidence: Array<{
    id: string;
    filename: string;
    mime_type: string;
    byte_size: number;
  }> = [];

  if (attachmentIds.length > 0) {
    const { data: attachmentRows } = await supabase
      .from("attachments")
      .select("id, filename, mime_type, byte_size")
      .in("id", attachmentIds);
    evidence =
      attachmentRows
        ?.filter((row) => row.byte_size != null)
        .map((row) => ({
          id: row.id,
          filename: row.filename,
          mime_type: row.mime_type,
          byte_size: row.byte_size as number,
        })) ?? [];
  }

  const membershipIds = [
    ...new Set([
      detail.owner_membership_id,
      detail.facilitator_membership_id,
      detail.created_by_membership_id,
      ...detail.status_history.map((entry) => entry.changed_by_membership_id),
      ...detail.stage_history.map((entry) => entry.changed_by_membership_id),
      ...detail.hypotheses.map((row) => row.created_by_membership_id),
      ...detail.countermeasures.map((row) => row.proposed_by_membership_id),
      ...detail.sessions.map((row) => row.facilitator_membership_id).filter(Boolean),
    ]),
  ].filter((id): id is string => Boolean(id));

  const membershipNameById: Record<string, string> = {};
  if (membershipIds.length > 0) {
    const { data: membershipRows } = await supabase
      .from("organisation_memberships")
      .select("id, display_name")
      .in("id", membershipIds);
    for (const row of membershipRows ?? []) {
      membershipNameById[row.id] = row.display_name ?? row.id.slice(0, 8);
    }
  }

  return (
    <div data-testid="problem-solving-detail-page">
      <CaseWorkspace
        detail={detail}
        currentConditionItems={(currentConditionRows as ProblemSolvingCurrentConditionItem[] | null) ?? []}
        containments={(containmentRows as ProblemSolvingContainment[] | null) ?? []}
        analyses={(analysisRows as ProblemSolvingAnalysis[] | null) ?? []}
        analysisNodes={analysisNodes}
        hypothesisTests={hypothesisTests}
        methodStages={methodStages}
        methods={methodsData?.items ?? []}
        comments={comments ?? []}
        evidence={evidence}
        membershipNameById={membershipNameById}
        ownerName={membershipNameById[detail.owner_membership_id] ?? null}
        facilitatorName={
          detail.facilitator_membership_id
            ? membershipNameById[detail.facilitator_membership_id] ?? null
            : null
        }
        canManage={canManage}
        canContribute={canContribute}
        canFacilitate={canFacilitate}
        canVerifyCause={canVerifyCause}
        canClose={canClose}
      />
      <Link
        href="/platform/problem-solving"
        className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
      >
        Back to problem solving
      </Link>
    </div>
  );
}
