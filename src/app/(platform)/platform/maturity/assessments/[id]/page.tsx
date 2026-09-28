import { notFound } from "next/navigation";

import {
  approveAssessment,
  beginAssessorReview,
  completeSelfAssessment,
  publishOfficialResult,
  submitAssessment,
} from "../../actions";
import { AssessmentWorkspace } from "@/components/maturity/assessment-workspace";
import { ReturnForCorrectionForm } from "@/components/maturity/return-for-correction-form";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { assessmentActionsHref } from "@/lib/actions/action-filters";
import { canEditMaturityAssessment } from "@/modules/maturity/formal-lifecycle";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { sortMaturityQuestions } from "@/modules/maturity/framework-authoring";
import { ScoreBadge } from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: assessment } = await supabase
    .from("maturity_assessments")
    .select(
      "id, status, assessment_type, model_version_id, submission_id, unit_id, lead_assessor_membership_id, created_by_membership_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!assessment) {
    notFound();
  }

  const { data: unit } = await supabase
    .from("organisation_units")
    .select("name")
    .eq("id", assessment.unit_id)
    .maybeSingle();

  const canReview = await currentMemberHasScopedPermission(
    MATURITY_PERMISSIONS.review,
    assessment.unit_id,
  );
  const canApprove = await currentMemberHasScopedPermission(
    MATURITY_PERMISSIONS.approve,
    assessment.unit_id,
  );
  const canPublish = await currentMemberHasScopedPermission(
    MATURITY_PERMISSIONS.resultsPublish,
    assessment.unit_id,
  );

  const { data: pillars } = await supabase
    .from("maturity_pillars")
    .select("id, name, position, section_id")
    .eq("model_version_id", assessment.model_version_id)
    .order("position");

  const pillarData = [];
  const criterionNameById = new Map<string, string>();
  const pillarNameById = new Map<string, string>();
  const questionPromptById = new Map<string, string>();

  for (const pillar of pillars ?? []) {
    pillarNameById.set(pillar.id, pillar.name);
    const { data: criteria } = await supabase
      .from("maturity_criteria")
      .select("id, name, description, guidance, position")
      .eq("pillar_id", pillar.id)
      .order("position");

    const criteriaWithQuestions = [];
    for (const criterion of criteria ?? []) {
      criterionNameById.set(criterion.id, criterion.name);
      const { data: links } = await supabase
        .from("maturity_criterion_questions")
        .select("question_id, contributes_to_score")
        .eq("criterion_id", criterion.id);

      const questions = [];
      for (const link of links ?? []) {
        const { data: q } = await supabase
          .from("template_questions")
          .select(
            "id, prompt, question_type, is_required, allows_not_applicable, help_text, options, position",
          )
          .eq("id", link.question_id)
          .maybeSingle();
        if (q) {
          questionPromptById.set(q.id, q.prompt);
          questions.push({
            ...q,
            contributes_to_score: link.contributes_to_score,
          });
        }
      }

      criteriaWithQuestions.push({
        ...criterion,
        questions: sortMaturityQuestions(questions),
      });
    }

    pillarData.push({
      id: pillar.id,
      name: pillar.name,
      criteria: criteriaWithQuestions,
    });
  }

  const { data: answerRows } = await supabase
    .from("template_answers")
    .select("question_id, text_value, number_value, is_not_applicable")
    .eq("submission_id", assessment.submission_id);

  const answers: Record<
    string,
    {
      text_value?: string | null;
      number_value?: number | null;
      is_not_applicable?: boolean;
    }
  > = {};
  for (const row of answerRows ?? []) {
    answers[row.question_id] = row;
  }

  const { data: evidenceLinks } = await supabase
    .from("maturity_evidence_links")
    .select("criterion_id, question_id, attachment_id")
    .eq("assessment_id", id);

  const attachmentIds = [
    ...new Set((evidenceLinks ?? []).map((link) => link.attachment_id)),
  ];
  const attachmentsById = new Map<
    string,
    {
      id: string;
      filename: string;
      mime_type: string;
      byte_size: number | null;
      storage_object_path: string;
    }
  >();
  if (attachmentIds.length > 0) {
    const { data: attachments } = await supabase
      .from("attachments")
      .select("id, filename, mime_type, byte_size, storage_object_path")
      .in("id", attachmentIds);
    for (const attachment of attachments ?? []) {
      attachmentsById.set(attachment.id, attachment);
    }
  }

  const evidence = [];
  for (const link of evidenceLinks ?? []) {
    const attachment = attachmentsById.get(link.attachment_id);
    if (attachment) {
      evidence.push({
        id: attachment.id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        byte_size: attachment.byte_size ?? 0,
        storage_object_path: attachment.storage_object_path,
        question_id: link.question_id,
        criterion_id: link.criterion_id,
      });
    }
  }

  const { data: scores } = await supabase
    .from("maturity_assessment_scores")
    .select("score_level, score")
    .eq("assessment_id", id);

  const { data: levelRows } = await supabase
    .from("maturity_levels")
    .select("level_number, name, guidance")
    .eq("model_version_id", assessment.model_version_id)
    .order("level_number");

  const { data: noteRows } = await supabase
    .from("maturity_assessment_criterion_notes")
    .select("criterion_id, comment_text")
    .eq("assessment_id", id);

  const criterionNotes: Record<string, string> = {};
  for (const row of noteRows ?? []) {
    criterionNotes[row.criterion_id] = row.comment_text;
  }

  const membershipIds = [
    assessment.lead_assessor_membership_id,
    assessment.created_by_membership_id,
  ].filter((value): value is string => Boolean(value));

  const { data: transitionRows } = await supabase
    .from("maturity_assessment_transitions")
    .select("to_status, actor_membership_id, created_at")
    .eq("assessment_id", id)
    .eq("to_status", "submitted")
    .order("created_at", { ascending: false })
    .limit(1);

  const submittedByMembershipId = transitionRows?.[0]?.actor_membership_id;
  if (submittedByMembershipId) {
    membershipIds.push(submittedByMembershipId);
  }

  const uniqueMembershipIds = [...new Set(membershipIds)];
  const membershipNameById = new Map<string, string>();
  if (uniqueMembershipIds.length > 0) {
    const { data: memberships } = await supabase
      .from("organisation_memberships")
      .select("id, display_name")
      .in("id", uniqueMembershipIds);
    for (const membership of memberships ?? []) {
      membershipNameById.set(
        membership.id,
        membership.display_name ?? "Unknown person",
      );
    }
  }

  const { data: actionContexts } = await supabase
    .from("maturity_action_context")
    .select("action_id, pillar_id, criterion_id, question_id")
    .eq("assessment_id", id);

  const actionIds = [
    ...new Set((actionContexts ?? []).map((row) => row.action_id)),
  ];
  const actionsById = new Map<
    string,
    {
      id: string;
      action_number: string | null;
      title: string;
      status: string;
      due_at: string | null;
    }
  >();
  const assigneeNameByActionId = new Map<string, string>();
  if (actionIds.length > 0) {
    const { data: actionRows } = await supabase
      .from("actions")
      .select("id, action_number, title, status, due_at")
      .in("id", actionIds);
    for (const action of actionRows ?? []) {
      actionsById.set(action.id, action);
    }

    const { data: assignees } = await supabase
      .from("action_assignees")
      .select("action_id, membership_id")
      .in("action_id", actionIds);
    const assigneeMembershipIds = [
      ...new Set((assignees ?? []).map((row) => row.membership_id)),
    ];
    const assigneeNames = new Map<string, string>();
    if (assigneeMembershipIds.length > 0) {
      const { data: assigneeMemberships } = await supabase
        .from("organisation_memberships")
        .select("id, display_name")
        .in("id", assigneeMembershipIds);
      for (const membership of assigneeMemberships ?? []) {
        assigneeNames.set(
          membership.id,
          membership.display_name ?? "Unknown person",
        );
      }
    }
    for (const assignee of assignees ?? []) {
      if (!assigneeNameByActionId.has(assignee.action_id)) {
        assigneeNameByActionId.set(
          assignee.action_id,
          assigneeNames.get(assignee.membership_id) ?? "Unknown person",
        );
      }
    }
  }

  const linkedActions = (actionContexts ?? [])
    .map((context) => {
      const action = actionsById.get(context.action_id);
      if (!action) return null;
      return {
        id: action.id,
        action_number: action.action_number,
        title: action.title,
        status: action.status,
        due_at: action.due_at,
        assignee_name: assigneeNameByActionId.get(action.id) ?? null,
        pillar_id: context.pillar_id,
        criterion_id: context.criterion_id,
        question_id: context.question_id,
        pillar_name: pillarNameById.get(context.pillar_id) ?? "Unknown pillar",
        criterion_name:
          criterionNameById.get(context.criterion_id) ?? "Unknown criterion",
        question_prompt: context.question_id
          ? (questionPromptById.get(context.question_id) ?? null)
          : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const overall = scores?.find((s) => s.score_level === "overall");
  const canEdit = canEditMaturityAssessment({
    status: assessment.status,
    canReview,
  });

  async function submitAction() {
    "use server";
    const result = await submitAssessment(id);
    if (result && "error" in result && result.error) {
      throw new Error(result.error);
    }
  }

  async function beginReviewAction() {
    "use server";
    const result = await beginAssessorReview(id);
    if (result && "error" in result && result.error) {
      throw new Error(result.error);
    }
  }

  async function approveAction() {
    "use server";
    const result = await approveAssessment(id);
    if (result && "error" in result && result.error) {
      throw new Error(result.error);
    }
  }

  async function publishAction() {
    "use server";
    const result = await publishOfficialResult(id);
    if (result && "error" in result && result.error) {
      throw new Error(result.error);
    }
  }

  async function completeSelfAction() {
    "use server";
    const result = await completeSelfAssessment(id);
    if (result && "error" in result && result.error) {
      throw new Error(result.error);
    }
  }

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="maturity-assessment-detail-page"
    >
      <PageHeader
        title="Assessment"
        description={`${unit?.name ?? "Unknown unit"} · Complete criterion responses and evidence.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {overall ? <ScoreBadge score={Number(overall.score)} /> : null}
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
        status={assessment.status}
        assessmentType={assessment.assessment_type}
        pillars={pillarData}
        levels={levelRows ?? []}
        answers={answers}
        criterionNotes={criterionNotes}
        evidence={evidence}
        canEdit={canEdit}
        linkedActions={linkedActions}
        leadAssessorName={
          assessment.lead_assessor_membership_id
            ? (membershipNameById.get(assessment.lead_assessor_membership_id) ??
              null)
            : null
        }
        submittedByName={
          submittedByMembershipId
            ? (membershipNameById.get(submittedByMembershipId) ?? null)
            : null
        }
      />

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-wrap gap-2">
          {canEdit &&
          assessment.assessment_type === "formal" &&
          (assessment.status === "draft" ||
            assessment.status === "in_progress") ? (
            <form action={submitAction}>
              <Button type="submit" data-testid="submit-assessment">
                Submit for assessor review
              </Button>
            </form>
          ) : null}
          {canEdit &&
          assessment.assessment_type === "self" &&
          (assessment.status === "draft" ||
            assessment.status === "in_progress") ? (
            <form action={completeSelfAction}>
              <Button type="submit" data-testid="complete-self-assessment">
                Complete self assessment
              </Button>
            </form>
          ) : null}
          {canReview &&
          assessment.status === "submitted" &&
          assessment.assessment_type === "formal" ? (
            <form action={beginReviewAction}>
              <Button type="submit" data-testid="begin-assessor-review">
                Begin assessor review
              </Button>
            </form>
          ) : null}
          {canApprove && assessment.status === "assessor_review" ? (
            <form action={approveAction}>
              <Button type="submit" data-testid="approve-assessment">
                Approve assessment
              </Button>
            </form>
          ) : null}
          {canPublish && assessment.status === "approved" ? (
            <form action={publishAction}>
              <Button type="submit" data-testid="publish-official-result">
                Publish official result
              </Button>
            </form>
          ) : null}
        </div>
        {canReview && assessment.status === "assessor_review" ? (
          <ReturnForCorrectionForm assessmentId={id} />
        ) : null}
      </div>
    </div>
  );
}
