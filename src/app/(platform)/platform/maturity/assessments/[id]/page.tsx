import Link from "next/link";
import { notFound } from "next/navigation";

import {
  approveAssessment,
  beginAssessorReview,
  completeSelfAssessment,
  publishOfficialResult,
  submitAssessment,
} from "../../actions";
import { AssessmentWorkspace } from "@/components/maturity/assessment-workspace";
import { AssessmentActionForm } from "@/components/maturity/assessment-action-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
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
      "id, status, assessment_type, model_version_id, submission_id, unit_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!assessment) {
    notFound();
  }

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
  for (const pillar of pillars ?? []) {
    const { data: criteria } = await supabase
      .from("maturity_criteria")
      .select("id, name, description, guidance, position")
      .eq("pillar_id", pillar.id)
      .order("position");

    const criteriaWithQuestions = [];
    for (const criterion of criteria ?? []) {
      const { data: links } = await supabase
        .from("maturity_criterion_questions")
        .select("question_id, contributes_to_score")
        .eq("criterion_id", criterion.id);

      const questions = [];
      for (const link of links ?? []) {
        const { data: q } = await supabase
          .from("template_questions")
          .select(
            "id, prompt, question_type, is_required, allows_not_applicable, help_text, options",
          )
          .eq("id", link.question_id)
          .maybeSingle();
        if (q) {
          questions.push({
            ...q,
            contributes_to_score: link.contributes_to_score,
          });
        }
      }

      criteriaWithQuestions.push({ ...criterion, questions });
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

  const evidence = [];
  for (const link of evidenceLinks ?? []) {
    const { data: attachment } = await supabase
      .from("attachments")
      .select("id, filename, mime_type, byte_size")
      .eq("id", link.attachment_id)
      .maybeSingle();
    if (attachment) {
      evidence.push({
        id: attachment.id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        byte_size: attachment.byte_size ?? 0,
        question_id: link.question_id,
        criterion_id: link.criterion_id,
      });
    }
  }

  const { data: scores } = await supabase
    .from("maturity_assessment_scores")
    .select("score_level, score")
    .eq("assessment_id", id);

  const overall = scores?.find((s) => s.score_level === "overall");

  const canEdit =
    assessment.status === "draft" || assessment.status === "in_progress";

  const firstCriterion = pillarData[0]?.criteria[0];
  const firstQuestion = firstCriterion?.questions[0];

  async function submitAction() {
    "use server";
    await submitAssessment(id);
  }

  async function beginReviewAction() {
    "use server";
    await beginAssessorReview(id);
  }

  async function approveAction() {
    "use server";
    await approveAssessment(id);
  }

  async function publishAction() {
    "use server";
    await publishOfficialResult(id);
  }

  async function completeSelfAction() {
    "use server";
    await completeSelfAssessment(id);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Assessment"
        description="Complete criterion responses and evidence."
        actions={
          <div className="flex flex-wrap gap-2">
            {overall ? <ScoreBadge score={Number(overall.score)} /> : null}
            <Button variant="outline" asChild>
              <Link href="/platform/maturity/assessments">All assessments</Link>
            </Button>
          </div>
        }
      />

      <AssessmentWorkspace
        assessmentId={id}
        status={assessment.status}
        assessmentType={assessment.assessment_type}
        pillars={pillarData}
        answers={answers}
        evidence={evidence}
        canEdit={canEdit}
        actionSlot={
          canEdit && firstCriterion && pillarData[0] ? (
            <AssessmentActionForm
              assessmentId={id}
              pillarId={pillarData[0].id}
              criterionId={firstCriterion.id}
              {...(firstQuestion ? { questionId: firstQuestion.id } : {})}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        {canEdit && assessment.assessment_type === "formal" ? (
          <form action={submitAction}>
            <Button type="submit" data-testid="submit-assessment">
              Submit for review
            </Button>
          </form>
        ) : null}
        {canEdit && assessment.assessment_type === "self" ? (
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
    </div>
  );
}
