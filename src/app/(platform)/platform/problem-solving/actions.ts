"use server";

import { revalidatePath } from "next/cache";

import { assertCanEditCaseDefinition } from "@/lib/problem-solving/assert-can-edit-case-definition";
import { evaluateVerifyEligibility } from "@/lib/problem-solving/hypothesis-verification-rules";
import { loadHypothesisForVerification } from "@/lib/problem-solving/load-hypothesis-for-verification";
import { normalizeFishboneCategory } from "@/lib/problem-solving/hypothesis";
import {
  CLOSED_CASE_FISHBONE_MUTATION_MESSAGE,
  FISHBONE_CAUSE_LABEL_MAX_LENGTH,
  PROMOTED_FISHBONE_CAUSE_LOCKED_MESSAGE,
  validatePromotedFishboneCauseMutable,
} from "@/lib/problem-solving/fishbone-cause-mutation-rules";
import { validateFishboneCausePromotion } from "@/lib/problem-solving/promote-fishbone-cause";
import {
  callProblemSolvingRpc,
  untypedFrom,
} from "@/lib/problem-solving/supabase-untyped";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import { assertPlanModuleWrite } from "@/modules/billing/assert-module-write";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type RpcArgs = Record<string, unknown>;
type ActionResult = { error?: string; ok?: true; id?: string };

async function callRpc<T = unknown>(fn: string, args?: RpcArgs): Promise<T> {
  const moduleGate = await assertPlanModuleWrite("problem_solving");
  if (!moduleGate.ok) {
    throw new Error(moduleGate.error);
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        params?: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    }
  ).rpc(fn, args ?? {});
  if (error) throw error;
  return data as T;
}

function revalidateCasePaths(caseId?: string) {
  revalidatePath("/platform/problem-solving");
  if (caseId) {
    revalidatePath(`/platform/problem-solving/${caseId}`, "page");
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

export async function updateProblemSolvingProblemStatement(
  caseId: string,
  problemStatement: string,
): Promise<ActionResult> {
  try {
    await callRpc("update_problem_solving_problem_statement", {
      target_case_id: caseId,
      target_problem_statement: problemStatement.trim(),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Problem statement update failed",
    };
  }
}

export async function updateProblemSolvingTargetCondition(
  caseId: string,
  targetCondition: string,
): Promise<ActionResult> {
  try {
    await callRpc("update_problem_solving_target_condition", {
      target_case_id: caseId,
      target_target_condition: targetCondition.trim(),
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Target condition update failed",
    };
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
    if (!input.statement.trim()) {
      return { error: "Hypothesis statement is required." };
    }
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
    const context = await loadHypothesisForVerification(caseId, hypothesisId);
    if (!context) {
      return { error: "Hypothesis not found on this case." };
    }
    const eligibility = evaluateVerifyEligibility({
      tests: context.tests,
      evidenceLinkCount: context.hypothesis.evidence_links?.length ?? 0,
      status: context.hypothesis.status,
    });
    if (!eligibility.allowed) {
      return { error: eligibility.reason };
    }
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
    if (!rejectionRationale?.trim()) {
      return { error: "What disproved it? is required." };
    }
    await callRpc("reject_cause_hypothesis", {
      target_hypothesis_id: hypothesisId,
      target_rejection_rationale: rejectionRationale.trim(),
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

async function resolvePrimaryFishboneAnalysisId(
  caseId: string,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await untypedFrom(
    supabase,
    "problem_solving_analyses",
  )
    .select("id, created_at")
    .eq("problem_solving_case_id", caseId)
    .eq("analysis_type", "fishbone")
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows[0]?.id) {
    return rows[0].id;
  }
  return callRpc<string>("create_analysis", {
    target_problem_solving_case_id: caseId,
    target_analysis_type: "fishbone",
    target_title: "Fishbone analysis",
  });
}

async function loadFishboneAnalysisNode(nodeId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await untypedFrom(
    supabase,
    "problem_solving_analysis_nodes",
  )
    .select("id, label, category, linked_hypothesis_id, analysis_id")
    .eq("id", nodeId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as {
    id: string;
    label: string;
    category: string | null;
    linked_hypothesis_id: string | null;
    analysis_id: string;
  } | null;
}

async function assertFishboneNodeInCase(
  caseId: string,
  analysisId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await untypedFrom(
    supabase,
    "problem_solving_analyses",
  )
    .select("id")
    .eq("id", analysisId)
    .eq("problem_solving_case_id", caseId)
    .eq("analysis_type", "fishbone")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("Fishbone cause not found on this case.");
  }
}

function mapCauseWorkRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("promoted fishbone") ||
    lower.includes("already promoted") ||
    lower.includes("different linked hypothesis")
  ) {
    return PROMOTED_FISHBONE_CAUSE_LOCKED_MESSAGE;
  }
  if (lower.includes("case is closed")) {
    return CLOSED_CASE_FISHBONE_MUTATION_MESSAGE;
  }
  if (lower.includes("500 characters")) {
    return `Keep the cause within ${FISHBONE_CAUSE_LABEL_MAX_LENGTH} characters.`;
  }
  if (lower.includes("analysis node not found")) {
    return "Fishbone cause not found.";
  }
  if (lower.includes("not authorised") || lower.includes("not authorized")) {
    return "You do not have permission to change this case.";
  }
  if (lower.includes("only fishbone")) {
    return "Only fishbone causes can be changed here.";
  }
  if (lower.includes("hypothesis statement is required")) {
    return "Hypothesis statement is required.";
  }
  return message;
}

async function assertCaseOpenForCauseWork(
  caseId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const detailResult = await callProblemSolvingRpc<ProblemSolvingCaseDetail>(
    supabase,
    "get_problem_solving_detail",
    { target_case_id: caseId },
  );
  if (detailResult.error || !detailResult.data) {
    return { error: "Problem solving case not found." };
  }
  if (["closed", "cancelled"].includes(detailResult.data.status)) {
    return { error: CLOSED_CASE_FISHBONE_MUTATION_MESSAGE };
  }
  return { ok: true };
}

export async function addFishboneCause(input: {
  caseId: string;
  category: string;
  label: string;
  mutationKey?: string;
}): Promise<ActionResult> {
  try {
    const access = await assertCanEditCaseDefinition(input.caseId);
    if ("error" in access) {
      return { error: access.error };
    }
    const caseOpen = await assertCaseOpenForCauseWork(input.caseId);
    if ("error" in caseOpen) {
      return { error: caseOpen.error };
    }
    const label = input.label.trim();
    if (!label) {
      return { error: "Cause description is required." };
    }
    if (label.length > FISHBONE_CAUSE_LABEL_MAX_LENGTH) {
      return {
        error: `Keep the cause within ${FISHBONE_CAUSE_LABEL_MAX_LENGTH} characters.`,
      };
    }
    const category = normalizeFishboneCategory(input.category);
    const analysisId = await resolvePrimaryFishboneAnalysisId(input.caseId);
    const id = await callRpc<string>("add_analysis_node", {
      target_analysis_id: analysisId,
      target_label: label,
      target_category: category,
      ...(input.mutationKey?.trim()
        ? { target_mutation_key: input.mutationKey.trim() }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fishbone cause create failed";
    return { error: mapCauseWorkRpcError(message) };
  }
}

export async function updateFishboneCause(input: {
  caseId: string;
  nodeId: string;
  label: string;
}): Promise<ActionResult> {
  try {
    const access = await assertCanEditCaseDefinition(input.caseId);
    if ("error" in access) {
      return { error: access.error };
    }
    const caseOpen = await assertCaseOpenForCauseWork(input.caseId);
    if ("error" in caseOpen) {
      return { error: caseOpen.error };
    }
    const label = input.label.trim();
    if (!label) {
      return { error: "Cause description is required." };
    }
    if (label.length > FISHBONE_CAUSE_LABEL_MAX_LENGTH) {
      return {
        error: `Keep the cause within ${FISHBONE_CAUSE_LABEL_MAX_LENGTH} characters.`,
      };
    }
    const node = await loadFishboneAnalysisNode(input.nodeId);
    if (!node) {
      return { error: "Fishbone cause not found." };
    }
    await assertFishboneNodeInCase(input.caseId, node.analysis_id);
    const mutable = validatePromotedFishboneCauseMutable(
      node.linked_hypothesis_id,
    );
    if ("error" in mutable) {
      return { error: mutable.error };
    }
    await callRpc("update_analysis_node", {
      target_node_id: input.nodeId,
      target_label: label,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fishbone cause update failed";
    return { error: mapCauseWorkRpcError(message) };
  }
}

export async function removeFishboneCause(input: {
  caseId: string;
  nodeId: string;
}): Promise<ActionResult> {
  try {
    const access = await assertCanEditCaseDefinition(input.caseId);
    if ("error" in access) {
      return { error: access.error };
    }
    const caseOpen = await assertCaseOpenForCauseWork(input.caseId);
    if ("error" in caseOpen) {
      return { error: caseOpen.error };
    }
    const node = await loadFishboneAnalysisNode(input.nodeId);
    if (!node) {
      return { error: "Fishbone cause not found." };
    }
    await assertFishboneNodeInCase(input.caseId, node.analysis_id);
    const mutable = validatePromotedFishboneCauseMutable(
      node.linked_hypothesis_id,
    );
    if ("error" in mutable) {
      return { error: mutable.error };
    }
    await callRpc("delete_analysis_node", {
      target_node_id: input.nodeId,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fishbone cause remove failed";
    return { error: mapCauseWorkRpcError(message) };
  }
}

export async function promoteFishboneCauseToHypothesis(input: {
  caseId: string;
  nodeId: string;
}): Promise<ActionResult> {
  try {
    const access = await assertCanEditCaseDefinition(input.caseId);
    if ("error" in access) {
      return { error: access.error };
    }
    const caseOpen = await assertCaseOpenForCauseWork(input.caseId);
    if ("error" in caseOpen) {
      return { error: caseOpen.error };
    }
    const node = await loadFishboneAnalysisNode(input.nodeId);
    if (!node) {
      return { error: "Fishbone cause not found." };
    }
    await assertFishboneNodeInCase(input.caseId, node.analysis_id);
    const category = normalizeFishboneCategory(node.category ?? "other");
    const promotionCheck = validateFishboneCausePromotion({
      linkedHypothesisId: node.linked_hypothesis_id,
      label: node.label,
      category,
    });
    if ("error" in promotionCheck) {
      return {
        error: promotionCheck.error,
        ...(node.linked_hypothesis_id ? { id: node.linked_hypothesis_id } : {}),
      };
    }
    const hypothesisId = await callRpc<string>(
      "promote_analysis_node_to_hypothesis",
      {
        target_node_id: input.nodeId,
        target_category: category,
        target_problem_solving_case_id: input.caseId,
      },
    );
    revalidateCasePaths(input.caseId);
    return { ok: true, id: hypothesisId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Promote to hypothesis failed";
    return { error: mapCauseWorkRpcError(message) };
  }
}

export async function createManualCauseHypothesis(input: {
  caseId: string;
  statement: string;
  category?: string;
  fishboneNodeId?: string;
}): Promise<ActionResult> {
  try {
    const access = await assertCanEditCaseDefinition(input.caseId);
    if ("error" in access) {
      return { error: access.error };
    }
    const caseOpen = await assertCaseOpenForCauseWork(input.caseId);
    if ("error" in caseOpen) {
      return { error: caseOpen.error };
    }
    const statement = input.statement.trim();
    if (!statement) {
      return { error: "Hypothesis statement is required." };
    }
    const category = input.category
      ? normalizeFishboneCategory(input.category)
      : undefined;

    if (input.fishboneNodeId) {
      const node = await loadFishboneAnalysisNode(input.fishboneNodeId);
      if (!node) {
        return { error: "Linked fishbone cause not found." };
      }
      await assertFishboneNodeInCase(input.caseId, node.analysis_id);
      const mutable = validatePromotedFishboneCauseMutable(
        node.linked_hypothesis_id,
      );
      if ("error" in mutable) {
        return { error: mutable.error };
      }
      const hypothesisId = await callRpc<string>(
        "promote_analysis_node_to_hypothesis",
        {
          target_node_id: input.fishboneNodeId,
          target_statement: statement,
          target_problem_solving_case_id: input.caseId,
          ...(category ? { target_category: category } : {}),
        },
      );
      revalidateCasePaths(input.caseId);
      return { ok: true, id: hypothesisId };
    }

    const hypothesisId = await callRpc<string>("create_hypothesis", {
      target_problem_solving_case_id: input.caseId,
      target_statement: statement,
      ...(category ? { target_category: category } : {}),
    });

    revalidateCasePaths(input.caseId);
    return { ok: true, id: hypothesisId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Hypothesis create failed";
    return { error: mapCauseWorkRpcError(message) };
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
    if (!input.label.trim()) {
      return { error: "Cause description is required." };
    }
    const id = await callRpc<string>("add_analysis_node", {
      target_analysis_id: input.analysisId,
      target_label: input.label.trim(),
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
  expectedResult?: string;
  method?: string;
  mutationKey?: string;
}): Promise<ActionResult> {
  try {
    if (!input.testQuestion.trim()) {
      return { error: "Test question is required." };
    }
    if (!input.method?.trim()) {
      return { error: "Verification method is required." };
    }
    const id = await callRpc<string>("create_hypothesis_test", {
      target_hypothesis_id: input.hypothesisId,
      target_test_question: input.testQuestion.trim(),
      ...(input.expectedResult?.trim()
        ? { target_expected_result: input.expectedResult.trim() }
        : {}),
      target_method: input.method.trim(),
      ...(input.mutationKey?.trim()
        ? { target_mutation_key: input.mutationKey.trim() }
        : {}),
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

export async function deleteHypothesisTest(input: {
  testId: string;
  caseId: string;
}): Promise<ActionResult> {
  try {
    await callRpc("delete_hypothesis_test", {
      target_hypothesis_test_id: input.testId,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Hypothesis test delete failed",
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
  expectedResult?: string;
  dueAt?: string;
  assigneeMembershipId?: string;
}): Promise<ActionResult> {
  try {
    if (!input.title.trim()) {
      return { error: "Action title is required." };
    }
    const id = await callRpc<string>("create_problem_solving_action", {
      target_title: input.title.trim(),
      target_problem_solving_case_id: input.caseId,
      target_context_role: input.contextRole,
      ...(input.containmentId
        ? { target_containment_id: input.containmentId }
        : {}),
      ...(input.countermeasureId
        ? { target_countermeasure_id: input.countermeasureId }
        : {}),
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.expectedResult?.trim()
        ? { target_expected_result: input.expectedResult.trim() }
        : {}),
      ...(input.dueAt ? { target_due_at: input.dueAt } : {}),
      ...(input.assigneeMembershipId
        ? { target_assignee_membership_id: input.assigneeMembershipId }
        : {}),
    });
    revalidateCasePaths(input.caseId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Action create failed",
    };
  }
}

export async function upsertProblemSolvingSustainPlan(input: {
  caseId: string;
  standardised: string;
  monitoring: string;
  ownerMembershipId?: string;
  reviewDate?: string;
}): Promise<ActionResult> {
  try {
    const standardised = input.standardised.trim();
    const monitoring = input.monitoring.trim();
    const ownerMembershipId = input.ownerMembershipId?.trim() ?? "";
    const reviewDate = input.reviewDate?.trim() ?? "";
    if (!standardised) {
      return { error: "What will be standardised is required." };
    }
    if (!monitoring) {
      return { error: "How it will be monitored is required." };
    }
    if (!ownerMembershipId) {
      return { error: "Sustain plan owner is required." };
    }
    if (!reviewDate) {
      return { error: "Review date is required." };
    }
    const today = new Date().toISOString().slice(0, 10);
    if (reviewDate < today) {
      return { error: "Review date cannot be in the past." };
    }
    await callRpc("upsert_problem_solving_sustain_plan", {
      target_case_id: input.caseId,
      target_sustain_plan_standardised: standardised,
      target_sustain_plan_monitoring: monitoring,
      target_sustain_plan_owner_membership_id: ownerMembershipId,
      target_sustain_plan_review_date: reviewDate,
    });
    revalidateCasePaths(input.caseId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Sustain plan save failed",
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
    if (
      (input.result === "fail" || input.result === "inconclusive") &&
      !input.verificationRationale?.trim()
    ) {
      return {
        error: "A note is required for Fail and Inconclusive outcomes.",
      };
    }
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
