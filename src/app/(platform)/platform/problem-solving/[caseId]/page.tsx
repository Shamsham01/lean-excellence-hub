import { CaseWorkspace } from "@/components/problem-solving/case-workspace";
import { AppLink } from "@/components/ui/app-link";
import { formatLongDate } from "@/lib/dates/format-long-date";
import { membershipDisplayLabel } from "@/lib/identity/membership-display-label";
import { resolveProblemSolvingDetailAccess } from "@/lib/problem-solving/detail-access";
import { loadCasePendingAiProposals } from "@/lib/problem-solving/load-case-pending-ai-proposals";
import { parseCaseAuditActivity } from "@/lib/problem-solving/case-audit-activity";
import { loadCaseWorkspaceData } from "@/lib/problem-solving/load-case-workspace-data";
import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import { loadProjectPickerOptions } from "@/lib/projects/load-project-picker-options";
import { projectLinkSummaryFromServer } from "@/lib/projects/project-link-summary";
import { resolveSiteUnitId } from "@/modules/organisation/applicability-unit-tree";
import { loadAccessibleOrganisationUnits } from "@/modules/organisation/site-context-server";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceRecordView } from "@/modules/workplace/access";
import { isApplicationAiProviderAvailable } from "@/platform/ai/config";
import { recoverProblemSolvingAiRunsForCase } from "@/platform/ai/recover-problem-solving-ai-runs";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { isTerminalCaseStatus } from "@/lib/problem-solving/case-lifecycle";

export const dynamic = "force-dynamic";

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
  const units = await loadAccessibleOrganisationUnits();
  const siteUnitId = resolveSiteUnitId(detail.organisation_unit_id, units);
  const projectPicker = siteUnitId
    ? await loadProjectPickerOptions(undefined, { siteUnitId })
    : { projects: [], requiresSiteSelection: true };
  if (canUseAi) {
    await recoverProblemSolvingAiRunsForCase(supabase, caseId);
  }
  const [workspaceData, auditPayload] = await Promise.all([
    loadCaseWorkspaceData(supabase, caseId, detail),
    callProblemSolvingRpc<unknown>(
      supabase,
      "get_problem_solving_case_audit_activity",
      { target_case_id: caseId },
    ),
  ]);
  const auditActivity = auditPayload.error
    ? []
    : parseCaseAuditActivity(auditPayload.data);

  const linkedProject = projectLinkSummaryFromServer(detail.linked_project);
  const canEditProjectLink =
    (canManage || canContribute) && ["draft", "active"].includes(detail.status);
  const pendingAiProposals =
    canUseAi &&
    isApplicationAiProviderAvailable() &&
    !isTerminalCaseStatus(detail.status)
      ? await loadCasePendingAiProposals(supabase, caseId, {
          canManage,
          canContribute,
        })
      : [];
  const providerAvailable = isApplicationAiProviderAvailable();
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (organisation) => organisation.selected,
  )?.membership_id;
  const canEditCaseDefinition =
    canManage || detail.owner_membership_id === currentMembershipId;
  const targetDueDateLabel = detail.target_due_at
    ? formatLongDate(detail.target_due_at)
    : null;

  return (
    <div
      className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:max-w-none"
      data-testid="problem-solving-detail-page"
    >
      <CaseWorkspace
        key={`${caseId}:${detail.status}`}
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
        auditActivity={auditActivity}
        currentMembershipId={currentMembershipId ?? null}
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
        canEditCaseDefinition={canEditCaseDefinition}
        canClose={canClose}
        canUseAi={canUseAi}
        providerAvailable={providerAvailable}
        pendingAiProposals={pendingAiProposals}
        linkedProject={linkedProject}
        projectSiteUnitId={siteUnitId}
        projectOptions={projectPicker.projects}
        requiresSiteSelection={projectPicker.requiresSiteSelection}
        canEditProjectLink={canEditProjectLink}
      />
      <AppLink
        href="/platform/problem-solving"
        className="mt-2 inline-block shrink-0 px-4 pb-2 text-sm text-muted-foreground hover:underline sm:px-6 lg:hidden"
        data-testid="problem-solving-back-link"
      >
        ← Problem solving portfolio
      </AppLink>
    </div>
  );
}
