import { CaseWorkspace } from "@/components/problem-solving/case-workspace";
import { AppLink } from "@/components/ui/app-link";
import { formatLongDate } from "@/lib/dates/format-long-date";
import { membershipDisplayLabel } from "@/lib/identity/membership-display-label";
import { resolveProblemSolvingDetailAccess } from "@/lib/problem-solving/detail-access";
import { loadCasePendingAiProposals } from "@/lib/problem-solving/load-case-pending-ai-proposals";
import { loadCaseWorkspaceData } from "@/lib/problem-solving/load-case-workspace-data";
import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceRecordView } from "@/modules/workplace/access";
import { isApplicationAiProviderAvailable } from "@/platform/ai/config";
import { recoverProblemSolvingAiRunsForCase } from "@/platform/ai/recover-problem-solving-ai-runs";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProblemSolvingCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const workplaceView = await loadWorkplaceRecordView({
    readPermission: "problem_solving.view",
    module: "problem_solving",
    recordId: caseId,
    title: "Problem solving",
    baselineOpensModule: true,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();

  const [
    detailResult,
    canManage,
    canContribute,
    canFacilitate,
    canVerifyCause,
    canClose,
    canUseAi,
  ] = await Promise.all([
    callProblemSolvingRpc<ProblemSolvingCaseDetail>(
      supabase,
      "get_problem_solving_detail",
      { target_case_id: caseId },
    ),
    currentMemberHasPermission("problem_solving.manage"),
    currentMemberHasPermission("problem_solving.contribute"),
    currentMemberHasPermission("problem_solving.facilitate"),
    currentMemberHasPermission("problem_solving.verify_cause"),
    currentMemberHasPermission("problem_solving.close"),
    currentMemberHasPermission("ai.use"),
  ]);

  const detail = await resolveProblemSolvingDetailAccess(detailResult);
  if (canUseAi) {
    await recoverProblemSolvingAiRunsForCase(supabase, caseId);
  }
  const workspaceData = await loadCaseWorkspaceData(supabase, caseId, detail);
  const pendingAiProposals =
    canUseAi && isApplicationAiProviderAvailable()
      ? await loadCasePendingAiProposals(supabase, caseId, {
          canManage,
          canContribute,
        })
      : [];
  const providerAvailable = isApplicationAiProviderAvailable();
  const targetDueDateLabel = detail.target_due_at
    ? formatLongDate(detail.target_due_at)
    : null;

  return (
    <div
      className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:max-w-none"
      data-testid="problem-solving-detail-page"
    >
      <CaseWorkspace
        key={caseId}
        detail={detail}
        targetDueDateLabel={targetDueDateLabel}
        currentConditionItems={workspaceData.currentConditionItems}
        containments={workspaceData.containments}
        analyses={workspaceData.analyses}
        analysisNodes={workspaceData.analysisNodes}
        hypothesisTests={workspaceData.hypothesisTests}
        methodStages={workspaceData.methodStages}
        methods={workspaceData.methods}
        pinnedMethodVersion={workspaceData.pinnedMethodVersion}
        comments={workspaceData.comments}
        evidence={workspaceData.evidence}
        membershipNameById={workspaceData.membershipNameById}
        ownerName={membershipDisplayLabel(
          detail.owner_display_name,
          workspaceData.membershipNameById[detail.owner_membership_id],
        )}
        facilitatorName={
          detail.facilitator_membership_id
            ? membershipDisplayLabel(
                detail.facilitator_display_name,
                workspaceData.membershipNameById[
                  detail.facilitator_membership_id
                ],
              )
            : null
        }
        canManage={canManage}
        canContribute={canContribute}
        canFacilitate={canFacilitate}
        canVerifyCause={canVerifyCause}
        canClose={canClose}
        canUseAi={canUseAi}
        providerAvailable={providerAvailable}
        pendingAiProposals={pendingAiProposals}
      />
      <AppLink
        href="/platform/problem-solving"
        className="mt-4 inline-block px-4 text-sm text-muted-foreground hover:underline sm:px-6 lg:hidden"
        data-testid="problem-solving-back-link"
      >
        ← Problem solving portfolio
      </AppLink>
    </div>
  );
}
