"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

type RpcArgs = Record<string, unknown>;
type ActionResult = { error?: string; ok?: true; id?: string };

async function callRpc<T = unknown>(fn: string, args?: RpcArgs): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const client = supabase as typeof supabase & {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
    ) => ReturnType<typeof supabase.rpc>;
  };
  const { data, error } = await client.rpc(fn, args ?? {});
  if (error) throw error;
  return data as T;
}

function revalidateCasePaths(caseId?: string) {
  revalidatePath("/platform/problem-solving");
  revalidatePath("/platform");
  if (caseId) {
    revalidatePath(`/platform/problem-solving/${caseId}`);
  }
}

export async function createProblemSolvingCaseDraft(input: {
  title: string;
  organisationalUnitId: string;
  problemStatement?: string;
  background?: string;
  businessImpact?: string;
  scopeIn?: string;
  scopeOut?: string;
  targetCondition?: string;
  detectedAt?: string;
  priority?: string;
  severity?: string;
  ownerMembershipId?: string;
  facilitatorMembershipId?: string;
  methodVersionId?: string;
  sourceResourceId?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_problem_solving_case_draft", {
      target_title: input.title,
      target_organisation_unit_id: input.organisationalUnitId,
      ...(input.problemStatement
        ? { target_problem_statement: input.problemStatement }
        : {}),
      ...(input.background ? { target_background: input.background } : {}),
      ...(input.businessImpact
        ? { target_business_impact: input.businessImpact }
        : {}),
      ...(input.scopeIn ? { target_scope_in: input.scopeIn } : {}),
      ...(input.scopeOut ? { target_scope_out: input.scopeOut } : {}),
      ...(input.targetCondition
        ? { target_target_condition: input.targetCondition }
        : {}),
      ...(input.detectedAt ? { target_detected_at: input.detectedAt } : {}),
      ...(input.priority ? { target_priority: input.priority } : {}),
      ...(input.severity ? { target_severity: input.severity } : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
      ...(input.facilitatorMembershipId
        ? { target_facilitator_membership_id: input.facilitatorMembershipId }
        : {}),
      ...(input.methodVersionId
        ? { target_method_version_id: input.methodVersionId }
        : {}),
      ...(input.sourceResourceId
        ? { target_source_resource_id: input.sourceResourceId }
        : {}),
    });
    revalidateCasePaths(id);
    return { ok: true, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Create failed" };
  }
}

export async function updateProblemSolvingCaseDraft(input: {
  caseId: string;
  title?: string;
  problemStatement?: string;
  background?: string;
  businessImpact?: string;
  scopeIn?: string;
  scopeOut?: string;
  targetCondition?: string;
  detectedAt?: string;
  priority?: string;
  severity?: string;
  ownerMembershipId?: string;
  facilitatorMembershipId?: string;
  methodVersionId?: string;
  targetDueAt?: string;
}): Promise<ActionResult> {
  try {
    await callRpc("update_problem_solving_case_draft", {
      target_case_id: input.caseId,
      ...(input.title ? { target_title: input.title } : {}),
      ...(input.problemStatement !== undefined
        ? { target_problem_statement: input.problemStatement }
        : {}),
      ...(input.background !== undefined
        ? { target_background: input.background }
        : {}),
      ...(input.businessImpact !== undefined
        ? { target_business_impact: input.businessImpact }
        : {}),
      ...(input.scopeIn !== undefined
        ? { target_scope_in: input.scopeIn }
        : {}),
      ...(input.scopeOut !== undefined
        ? { target_scope_out: input.scopeOut }
        : {}),
      ...(input.targetCondition !== undefined
        ? { target_target_condition: input.targetCondition }
        : {}),
      ...(input.detectedAt ? { target_detected_at: input.detectedAt } : {}),
      ...(input.priority ? { target_priority: input.priority } : {}),
      ...(input.severity ? { target_severity: input.severity } : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
      ...(input.facilitatorMembershipId
        ? { target_facilitator_membership_id: input.facilitatorMembershipId }
        : {}),
      ...(input.methodVersionId
        ? { target_method_version_id: input.methodVersionId }
        : {}),
      ...(input.targetDueAt ? { target_target_due_at: input.targetDueAt } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Update failed" };
  }
}

export async function addProblemSolvingSourceLink(
  caseId: string,
  sourceResourceId: string,
  linkRole = "related",
): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("add_problem_solving_source_link", {
      target_case_id: caseId,
      target_source_resource_id: sourceResourceId,
      target_link_role: linkRole,
    });
    revalidateCasePaths(caseId);
    return { ok: true, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Link failed" };
  }
}

export async function removeProblemSolvingSourceLink(
  linkId: string,
  caseId: string,
): Promise<ActionResult> {
  try {
    await callRpc("remove_problem_solving_source_link", {
      target_link_id: linkId,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unlink failed" };
  }
}

export async function activateProblemSolvingCase(
  caseId: string,
  methodId: string,
): Promise<ActionResult> {
  try {
    await callRpc("activate_problem_solving_case", {
      target_case_id: caseId,
      target_method_id: methodId,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Activation failed",
    };
  }
}

export async function moveProblemSolvingStage(
  caseId: string,
  stageId: string,
): Promise<ActionResult> {
  try {
    await callRpc("move_problem_solving_stage", {
      target_case_id: caseId,
      target_stage_id: stageId,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Stage move failed",
    };
  }
}

export async function closeProblemSolvingCase(
  caseId: string,
  closureOutcome: string,
  closureRationale?: string,
): Promise<ActionResult> {
  try {
    await callRpc("close_problem_solving_case", {
      target_case_id: caseId,
      target_closure_outcome: closureOutcome,
      ...(closureRationale
        ? { target_closure_rationale: closureRationale }
        : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Close failed" };
  }
}

export async function cancelProblemSolvingCase(
  caseId: string,
  cancellationRationale: string,
): Promise<ActionResult> {
  try {
    await callRpc("cancel_problem_solving_case", {
      target_case_id: caseId,
      target_cancellation_rationale: cancellationRationale,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cancel failed" };
  }
}

export async function createCurrentConditionItem(input: {
  caseId: string;
  category: string;
  statement: string;
  supersedesItemId?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_current_condition_item", {
      target_case_id: input.caseId,
      target_category: input.category,
      target_statement: input.statement,
      ...(input.supersedesItemId
        ? { target_supersedes_item_id: input.supersedesItemId }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Item create failed",
    };
  }
}

export async function verifyCurrentConditionItem(
  itemId: string,
  caseId: string,
  verificationRationale?: string,
): Promise<ActionResult> {
  try {
    await callRpc("verify_current_condition_item", {
      target_item_id: itemId,
      ...(verificationRationale
        ? { target_verification_rationale: verificationRationale }
        : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

export async function createContainment(input: {
  caseId: string;
  description: string;
  rationale?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_containment", {
      target_problem_solving_case_id: input.caseId,
      target_description: input.description,
      ...(input.rationale ? { target_rationale: input.rationale } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Containment create failed",
    };
  }
}

export async function releaseContainment(
  containmentId: string,
  caseId: string,
  releaseRationale?: string,
): Promise<ActionResult> {
  try {
    await callRpc("release_containment", {
      target_containment_id: containmentId,
      ...(releaseRationale
        ? { target_release_rationale: releaseRationale }
        : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Release failed" };
  }
}

export async function createHypothesis(input: {
  caseId: string;
  statement: string;
  parentHypothesisId?: string;
  category?: string;
  rationale?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_hypothesis", {
      target_problem_solving_case_id: input.caseId,
      target_statement: input.statement,
      ...(input.parentHypothesisId
        ? { target_parent_hypothesis_id: input.parentHypothesisId }
        : {}),
      ...(input.category ? { target_category: input.category } : {}),
      ...(input.rationale ? { target_rationale: input.rationale } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Hypothesis create failed",
    };
  }
}

export async function verifyCauseHypothesis(
  hypothesisId: string,
  caseId: string,
  verificationRationale: string,
): Promise<ActionResult> {
  try {
    await callRpc("verify_cause_hypothesis", {
      target_hypothesis_id: hypothesisId,
      target_verification_rationale: verificationRationale,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

export async function rejectCauseHypothesis(
  hypothesisId: string,
  caseId: string,
  rejectionRationale?: string,
): Promise<ActionResult> {
  try {
    await callRpc("reject_cause_hypothesis", {
      target_hypothesis_id: hypothesisId,
      ...(rejectionRationale
        ? { target_rejection_rationale: rejectionRationale }
        : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Rejection failed",
    };
  }
}

export async function createCountermeasure(input: {
  caseId: string;
  title: string;
  description?: string;
  rationale?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_countermeasure", {
      target_case_id: input.caseId,
      target_title: input.title,
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.rationale ? { target_rationale: input.rationale } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Countermeasure create failed",
    };
  }
}

export async function selectCountermeasure(
  countermeasureId: string,
  caseId: string,
  selectedRationale?: string,
): Promise<ActionResult> {
  try {
    await callRpc("select_countermeasure", {
      target_countermeasure_id: countermeasureId,
      ...(selectedRationale ? { target_rationale: selectedRationale } : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Selection failed",
    };
  }
}

export async function startProblemSolvingSession(input: {
  caseId: string;
  title: string;
  facilitatorMembershipId?: string;
  scheduledAt?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("start_problem_solving_session", {
      target_case_id: input.caseId,
      target_title: input.title,
      ...(input.facilitatorMembershipId
        ? { target_facilitator_membership_id: input.facilitatorMembershipId }
        : {}),
      ...(input.scheduledAt ? { target_scheduled_at: input.scheduledAt } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Session start failed",
    };
  }
}

export async function completeProblemSolvingSession(
  sessionId: string,
  caseId: string,
  summary?: string,
): Promise<ActionResult> {
  try {
    await callRpc("complete_problem_solving_session", {
      target_session_id: sessionId,
      ...(summary ? { target_summary: summary } : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Session complete failed",
    };
  }
}

export async function linkProblemSolvingEvidence(
  caseId: string,
  attachmentId: string,
  options?: {
    isCaseLevel?: boolean;
    hypothesisId?: string;
    countermeasureId?: string;
    currentConditionItemId?: string;
    containmentId?: string;
  },
): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("link_problem_solving_evidence", {
      target_case_id: caseId,
      target_attachment_id: attachmentId,
      target_is_case_level: options?.isCaseLevel ?? true,
      ...(options?.hypothesisId
        ? { target_hypothesis_id: options.hypothesisId }
        : {}),
      ...(options?.countermeasureId
        ? { target_countermeasure_id: options.countermeasureId }
        : {}),
      ...(options?.currentConditionItemId
        ? { target_current_condition_item_id: options.currentConditionItemId }
        : {}),
      ...(options?.containmentId
        ? { target_containment_id: options.containmentId }
        : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Evidence link failed",
    };
  }
}

export async function initiateProblemSolvingEvidenceUpload(
  caseId: string,
  filename: string,
  mimeType: string,
  byteSize: number,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("initiate_attachment_upload", {
    target_resource_id: caseId,
    target_filename: filename,
    target_mime_type: mimeType,
    target_byte_size: byteSize,
  });
  if (error) return { error: error.message };
  const row = (
    data as Array<{ attachment_id: string; storage_object_path: string }>
  )[0];
  if (!row) return { error: "Upload initiation failed" };
  return {
    attachmentId: row.attachment_id,
    storagePath: row.storage_object_path,
  };
}

export async function confirmProblemSolvingEvidenceUpload(
  caseId: string,
  attachmentId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });
  if (error) return { error: error.message };
  const linkResult = await linkProblemSolvingEvidence(caseId, attachmentId, {
    isCaseLevel: true,
  });
  if (linkResult.error) return { error: linkResult.error };
  revalidateCasePaths(caseId);
  return {};
}

export async function createAnalysis(input: {
  caseId: string;
  analysisType: string;
  title: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_analysis", {
      target_problem_solving_case_id: input.caseId,
      target_analysis_type: input.analysisType,
      target_title: input.title,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Analysis create failed",
    };
  }
}

export async function addAnalysisNode(input: {
  analysisId: string;
  caseId: string;
  label: string;
  category?: string;
  sortOrder?: number;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("add_analysis_node", {
      target_analysis_id: input.analysisId,
      target_label: input.label,
      ...(input.category ? { target_category: input.category } : {}),
      ...(input.sortOrder != null
        ? { target_sort_order: input.sortOrder }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Analysis node create failed",
    };
  }
}

export async function updateHypothesisStatus(
  hypothesisId: string,
  caseId: string,
  status: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("update_hypothesis_status", {
      target_hypothesis_id: hypothesisId,
      target_status: status,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Hypothesis status update failed",
    };
  }
}

export async function createHypothesisTest(input: {
  hypothesisId: string;
  caseId: string;
  testQuestion: string;
  expectedResult: string;
  method?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_hypothesis_test", {
      target_hypothesis_id: input.hypothesisId,
      target_test_question: input.testQuestion,
      target_expected_result: input.expectedResult,
      ...(input.method ? { target_method: input.method } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Hypothesis test create failed",
    };
  }
}

export async function completeHypothesisTest(input: {
  testId: string;
  caseId: string;
  actualResult: string;
  conclusion: string;
}): Promise<ActionResult> {
  try {
    await callRpc("complete_hypothesis_test", {
      target_hypothesis_test_id: input.testId,
      target_actual_result: input.actualResult,
      target_conclusion: input.conclusion,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Hypothesis test completion failed",
    };
  }
}

export async function createProblemSolvingAction(input: {
  caseId: string;
  title: string;
  contextRole: string;
  containmentId?: string;
  countermeasureId?: string;
  description?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_problem_solving_action", {
      target_title: input.title,
      target_problem_solving_case_id: input.caseId,
      target_context_role: input.contextRole,
      ...(input.containmentId
        ? { target_containment_id: input.containmentId }
        : {}),
      ...(input.countermeasureId
        ? { target_countermeasure_id: input.countermeasureId }
        : {}),
      ...(input.description ? { target_description: input.description } : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Action create failed",
    };
  }
}

export async function linkCountermeasureCauses(
  countermeasureId: string,
  caseId: string,
  hypothesisIds: string[],
): Promise<ActionResult> {
  try {
    await callRpc("link_countermeasure_causes", {
      target_countermeasure_id: countermeasureId,
      target_hypothesis_ids: hypothesisIds,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Cause link failed",
    };
  }
}

export async function createEffectivenessCheck(input: {
  caseId: string;
  criterion: string;
  baselineNumeric?: number;
  targetNumeric?: number;
  unit?: string;
  observationWindowStart?: string;
  observationWindowEnd?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_effectiveness_check", {
      target_case_id: input.caseId,
      target_criterion: input.criterion,
      ...(input.baselineNumeric != null
        ? { target_baseline_numeric: input.baselineNumeric }
        : {}),
      ...(input.targetNumeric != null
        ? { target_target_numeric: input.targetNumeric }
        : {}),
      ...(input.unit ? { target_unit: input.unit } : {}),
      ...(input.observationWindowStart
        ? { target_observation_window_start: input.observationWindowStart }
        : {}),
      ...(input.observationWindowEnd
        ? { target_observation_window_end: input.observationWindowEnd }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Effectiveness check create failed",
    };
  }
}

export async function recordEffectivenessResult(input: {
  effectivenessCheckId: string;
  caseId: string;
  result: string;
  actualNumeric?: number;
  verificationRationale?: string;
}): Promise<ActionResult> {
  try {
    await callRpc("record_effectiveness_result", {
      target_effectiveness_check_id: input.effectivenessCheckId,
      target_result: input.result,
      ...(input.actualNumeric != null
        ? { target_actual_numeric: input.actualNumeric }
        : {}),
      ...(input.verificationRationale
        ? { target_verification_rationale: input.verificationRationale }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Effectiveness result failed",
    };
  }
}

export async function createSustainmentItem(input: {
  caseId: string;
  what: string;
  checkMethod?: string;
  followUpDate?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_sustainment_item", {
      target_case_id: input.caseId,
      target_what: input.what,
      ...(input.checkMethod ? { target_check_method: input.checkMethod } : {}),
      ...(input.followUpDate
        ? { target_follow_up_date: input.followUpDate }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Sustainment item create failed",
    };
  }
}

export async function addSessionEntry(input: {
  sessionId: string;
  caseId: string;
  entryType: string;
  body: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("add_session_entry", {
      target_session_id: input.sessionId,
      target_entry_type: input.entryType,
      target_body: input.body,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Session entry failed",
    };
  }
}
