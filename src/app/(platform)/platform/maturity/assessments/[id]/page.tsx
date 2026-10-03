import { notFound } from "next/navigation";

import { AssessmentWorkspace } from "@/components/maturity/assessment-workspace";
import { ReturnForCorrectionForm } from "@/components/maturity/return-for-correction-form";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { assessmentActionsHref } from "@/lib/actions/action-filters";
import { isAssistantUuid } from "@/modules/leanai-context/assistant/constants";
import { loadAssessmentWorkspace } from "@/modules/maturity/load-assessment-workspace";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { ScoreBadge } from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criterion?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const criterionParam = Array.isArray(query.criterion)
    ? query.criterion[0]
    : query.criterion;
  const initialCriterionId = isAssistantUuid(criterionParam)
    ? criterionParam
    : null;

  const supabase = await createServerSupabaseClient();
  const { data: assessment } = await supabase
    .from("maturity_assessments")
    .select("id, unit_id")
    .eq("id", id)
    .maybeSingle();

  if (!assessment) {
    notFound();
  }

  const [canReview, canApprove, canPublish] = await Promise.all([
    currentMemberHasScopedPermission(
      MATURITY_PERMISSIONS.review,
      assessment.unit_id,
    ),
    currentMemberHasScopedPermission(
      MATURITY_PERMISSIONS.approve,
      assessment.unit_id,
    ),
    currentMemberHasScopedPermission(
      MATURITY_PERMISSIONS.resultsPublish,
      assessment.unit_id,
    ),
  ]);

  const workspace = await loadAssessmentWorkspace(id, {
    canReview,
    canApprove,
    canPublish,
  });

  if (!workspace) {
    notFound();
  }

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="maturity-assessment-detail-page"
    >
      <PageHeader
        title="Assessment"
        description={`${workspace.unitName} · Complete criterion responses and evidence.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {workspace.overallScore != null ? (
              <ScoreBadge score={workspace.overallScore} />
            ) : null}
            <Button variant="outline" asChild>
              <AppLink
                href={assessmentActionsHref(id)}
                data-testid="view-assessment-actions"
              >
                View assessment actions
              </AppLink>
            </Button>
            <Button variant="outline" asChild>
              <AppLink
                href="/platform/maturity/assessments"
                data-testid="maturity-assessments-back-link"
              >
                All assessments
              </AppLink>
            </Button>
          </div>
        }
      />

      <AssessmentWorkspace
        assessmentId={id}
        status={workspace.status}
        assessmentType={workspace.assessmentType}
        pillars={workspace.pillars}
        levels={workspace.levels}
        answers={workspace.answers}
        criterionNotes={workspace.criterionNotes}
        questionNotes={workspace.questionNotes}
        evidence={workspace.evidence}
        canEdit={workspace.canEdit}
        linkedActions={workspace.linkedActions}
        leadAssessorName={workspace.leadAssessorName}
        submittedByName={workspace.submittedByName}
        lifecycle={workspace.lifecycle}
        initialCriterionId={initialCriterionId}
      />

      {workspace.lifecycle.canReturnForCorrection ? (
        <div className="border-t border-border pt-6">
          <ReturnForCorrectionForm assessmentId={id} />
        </div>
      ) : null}
    </div>
  );
}
