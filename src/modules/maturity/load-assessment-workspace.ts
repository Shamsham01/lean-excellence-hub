import "server-only";

import { sortMaturityQuestions } from "@/modules/maturity/framework-authoring";
import { canEditMaturityAssessment } from "@/modules/maturity/formal-lifecycle";
import { buildAssessmentReadiness } from "@/modules/maturity/assessment-readiness";
import type {
  AssessmentAnswer,
  AssessmentLevel,
  AssessmentLifecyclePermissions,
  AssessmentPillar,
  AssessmentReadiness,
  LinkedAssessmentAction,
} from "@/modules/maturity/assessment-workspace-types";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type AssessmentWorkspaceRecord = {
  id: string;
  status: string;
  assessmentType: string;
  modelVersionId: string;
  unitId: string;
  unitName: string;
  frameworkName: string | null;
  canEdit: boolean;
  canReview: boolean;
  pillars: AssessmentPillar[];
  levels: AssessmentLevel[];
  answers: Record<string, AssessmentAnswer>;
  criterionNotes: Record<string, string>;
  questionNotes: Record<string, string>;
  evidence: EvidenceItem[];
  linkedActions: LinkedAssessmentAction[];
  leadAssessorName: string | null;
  submittedByName: string | null;
  overallScore: number | null;
  readiness: AssessmentReadiness;
  lifecycle: AssessmentLifecyclePermissions;
};

function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadAssessmentWorkspace(
  assessmentId: string,
  permissions: {
    canReview: boolean;
    canApprove: boolean;
    canPublish: boolean;
  },
): Promise<AssessmentWorkspaceRecord | null> {
  const supabase = await createServerSupabaseClient();

  const { data: assessment } = await supabase
    .from("maturity_assessments")
    .select(
      "id, status, assessment_type, model_version_id, submission_id, unit_id, lead_assessor_membership_id, created_by_membership_id",
    )
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) {
    return null;
  }

  const [
    unitResult,
    versionResult,
    pillarsResult,
    levelsResult,
    answerResult,
    evidenceLinkResult,
    scoreResult,
    criterionNoteResult,
    questionNoteResult,
    transitionResult,
    actionContextResult,
  ] = await Promise.all([
    supabase
      .from("organisation_units")
      .select("name")
      .eq("id", assessment.unit_id)
      .maybeSingle(),
    supabase
      .from("maturity_model_versions")
      .select("display_name")
      .eq("id", assessment.model_version_id)
      .maybeSingle(),
    supabase
      .from("maturity_pillars")
      .select("id, name, position, section_id")
      .eq("model_version_id", assessment.model_version_id)
      .order("position"),
    supabase
      .from("maturity_levels")
      .select("level_number, name, guidance")
      .eq("model_version_id", assessment.model_version_id)
      .order("level_number"),
    supabase
      .from("template_answers")
      .select("question_id, text_value, number_value, is_not_applicable")
      .eq("submission_id", assessment.submission_id),
    supabase
      .from("maturity_evidence_links")
      .select("criterion_id, question_id, attachment_id")
      .eq("assessment_id", assessmentId),
    supabase
      .from("maturity_assessment_scores")
      .select("score_level, score")
      .eq("assessment_id", assessmentId),
    supabase
      .from("maturity_assessment_criterion_notes")
      .select("criterion_id, comment_text")
      .eq("assessment_id", assessmentId),
    supabase
      .from("maturity_assessment_question_notes")
      .select("question_id, comment_text")
      .eq("assessment_id", assessmentId),
    supabase
      .from("maturity_assessment_transitions")
      .select("to_status, actor_membership_id, created_at")
      .eq("assessment_id", assessmentId)
      .eq("to_status", "submitted")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("maturity_action_context")
      .select("action_id, pillar_id, criterion_id, question_id")
      .eq("assessment_id", assessmentId),
  ]);

  const pillars = pillarsResult.data ?? [];
  const pillarIds = pillars.map((pillar) => pillar.id);
  const { data: criterionRows } =
    pillarIds.length > 0
      ? await supabase
          .from("maturity_criteria")
          .select("id, name, description, guidance, position, pillar_id")
          .in("pillar_id", pillarIds)
          .order("position")
      : { data: [] };

  const criteria = criterionRows ?? [];
  const criterionIds = criteria.map((criterion) => criterion.id);
  const { data: linkRows } =
    criterionIds.length > 0
      ? await supabase
          .from("maturity_criterion_questions")
          .select("criterion_id, question_id, contributes_to_score")
          .in("criterion_id", criterionIds)
      : { data: [] };

  const links = linkRows ?? [];
  const questionIds = [...new Set(links.map((link) => link.question_id))];
  const { data: questionRows } =
    questionIds.length > 0
      ? await supabase
          .from("template_questions")
          .select(
            "id, prompt, question_type, is_required, allows_not_applicable, help_text, position",
          )
          .in("id", questionIds)
      : { data: [] };

  const questionById = new Map(
    (questionRows ?? []).map((row) => [row.id, row]),
  );
  const questionsByCriterion = new Map<
    string,
    Array<{
      id: string;
      prompt: string;
      question_type: string;
      is_required: boolean;
      allows_not_applicable: boolean;
      help_text: string | null;
      contributes_to_score: boolean;
      position: number;
    }>
  >();
  const questionPromptById = new Map<string, string>();
  const criterionNameById = new Map<string, string>();
  const pillarNameById = new Map<string, string>();

  for (const pillar of pillars) {
    pillarNameById.set(pillar.id, pillar.name);
  }
  for (const criterion of criteria) {
    criterionNameById.set(criterion.id, criterion.name);
  }

  for (const link of links) {
    const question = questionById.get(link.question_id);
    if (!question) {
      continue;
    }
    questionPromptById.set(question.id, question.prompt);
    const group = questionsByCriterion.get(link.criterion_id) ?? [];
    group.push({
      id: question.id,
      prompt: question.prompt,
      question_type: question.question_type,
      is_required: question.is_required,
      allows_not_applicable: question.allows_not_applicable,
      help_text: question.help_text,
      contributes_to_score: link.contributes_to_score,
      position: question.position,
    });
    questionsByCriterion.set(link.criterion_id, group);
  }

  const criteriaByPillar = new Map<string, typeof criteria>();
  for (const criterion of criteria) {
    const group = criteriaByPillar.get(criterion.pillar_id) ?? [];
    group.push(criterion);
    criteriaByPillar.set(criterion.pillar_id, group);
  }

  const pillarData: AssessmentPillar[] = pillars.map((pillar) => ({
    id: pillar.id,
    name: pillar.name,
    criteria: (criteriaByPillar.get(pillar.id) ?? []).map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      guidance: criterion.guidance,
      questions: sortMaturityQuestions(
        questionsByCriterion.get(criterion.id) ?? [],
      ),
    })),
  }));

  const answers: Record<string, AssessmentAnswer> = {};
  for (const row of answerResult.data ?? []) {
    answers[row.question_id] = {
      text_value: row.text_value,
      number_value: asFiniteNumber(row.number_value),
      is_not_applicable: row.is_not_applicable,
    };
  }

  const attachmentIds = [
    ...new Set(
      (evidenceLinkResult.data ?? []).map((link) => link.attachment_id),
    ),
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
      attachmentsById.set(attachment.id, {
        id: attachment.id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        byte_size: asFiniteNumber(attachment.byte_size),
        storage_object_path: attachment.storage_object_path,
      });
    }
  }

  const evidence: EvidenceItem[] = [];
  for (const link of evidenceLinkResult.data ?? []) {
    const attachment = attachmentsById.get(link.attachment_id);
    if (!attachment) {
      continue;
    }
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

  const criterionNotes: Record<string, string> = {};
  for (const row of criterionNoteResult.data ?? []) {
    criterionNotes[row.criterion_id] = row.comment_text;
  }

  const questionNotes: Record<string, string> = {};
  if (!questionNoteResult.error) {
    for (const row of questionNoteResult.data ?? []) {
      questionNotes[row.question_id] = row.comment_text;
    }
  }

  const membershipIds = [
    assessment.lead_assessor_membership_id,
    assessment.created_by_membership_id,
    transitionResult.data?.[0]?.actor_membership_id,
  ].filter((value): value is string => Boolean(value));

  const actionIds = [
    ...new Set((actionContextResult.data ?? []).map((row) => row.action_id)),
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
  let assigneeMembershipIds: string[] = [];
  let assignees: Array<{ action_id: string; membership_id: string }> = [];

  if (actionIds.length > 0) {
    const [{ data: actionRows }, { data: assigneeRows }] = await Promise.all([
      supabase
        .from("actions")
        .select("id, action_number, title, status, due_at")
        .in("id", actionIds),
      supabase
        .from("action_assignees")
        .select("action_id, membership_id")
        .in("action_id", actionIds),
    ]);
    for (const action of actionRows ?? []) {
      actionsById.set(action.id, action);
    }
    assignees = assigneeRows ?? [];
    assigneeMembershipIds = [
      ...new Set(assignees.map((row) => row.membership_id)),
    ];
  }

  const uniqueMembershipIds = [
    ...new Set([...membershipIds, ...assigneeMembershipIds]),
  ];
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
  for (const assignee of assignees) {
    if (!assigneeNameByActionId.has(assignee.action_id)) {
      assigneeNameByActionId.set(
        assignee.action_id,
        membershipNameById.get(assignee.membership_id) ?? "Unknown person",
      );
    }
  }

  const linkedActions = (actionContextResult.data ?? [])
    .map((context) => {
      const action = actionsById.get(context.action_id);
      if (!action) {
        return null;
      }
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
    .filter((row): row is LinkedAssessmentAction => row != null);

  const overall = (scoreResult.data ?? []).find(
    (row) => row.score_level === "overall",
  );
  const canEdit = canEditMaturityAssessment({
    status: assessment.status,
    canReview: permissions.canReview,
  });
  const readiness = buildAssessmentReadiness(pillarData, answers);
  const submittedByMembershipId =
    transitionResult.data?.[0]?.actor_membership_id;
  const editable =
    assessment.status === "draft" || assessment.status === "in_progress";

  return {
    id: assessment.id,
    status: assessment.status,
    assessmentType: assessment.assessment_type,
    modelVersionId: assessment.model_version_id,
    unitId: assessment.unit_id,
    unitName: unitResult.data?.name ?? "Unknown unit",
    frameworkName: versionResult.data?.display_name ?? null,
    canEdit,
    canReview: permissions.canReview,
    pillars: pillarData,
    levels: (levelsResult.data ?? []).map((level) => ({
      level_number: level.level_number,
      name: level.name,
      guidance: level.guidance,
    })),
    answers,
    criterionNotes,
    questionNotes,
    evidence,
    linkedActions,
    leadAssessorName: assessment.lead_assessor_membership_id
      ? (membershipNameById.get(assessment.lead_assessor_membership_id) ?? null)
      : null,
    submittedByName: submittedByMembershipId
      ? (membershipNameById.get(submittedByMembershipId) ?? null)
      : null,
    overallScore: asFiniteNumber(overall?.score),
    readiness,
    lifecycle: {
      canCompleteSelf:
        canEdit && assessment.assessment_type === "self" && editable,
      canSubmitFormal:
        canEdit && assessment.assessment_type === "formal" && editable,
      canBeginReview:
        permissions.canReview &&
        assessment.status === "submitted" &&
        assessment.assessment_type === "formal",
      canApprove:
        permissions.canApprove && assessment.status === "assessor_review",
      canPublish: permissions.canPublish && assessment.status === "approved",
      canReturnForCorrection:
        permissions.canReview && assessment.status === "assessor_review",
    },
  };
}
