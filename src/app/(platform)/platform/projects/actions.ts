"use server";

import { revalidatePath } from "next/cache";

import { mapProjectMutationError } from "@/lib/projects/errors";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type RpcArgs = Record<string, unknown>;
type ActionResult = { error?: string; ok?: true; id?: string };

async function callRpc<T = unknown>(fn: string, args?: RpcArgs): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    fn as "create_improvement_project",
    (args ?? {}) as never,
  );
  if (error) throw error;
  return data as T;
}

function revalidateProjectPaths(projectId: string) {
  revalidatePath(`/platform/projects/${projectId}`);
  revalidatePath("/platform/projects");
}

export async function createImprovementProject(input: {
  title: string;
  unitId: string;
  problemStatement?: string;
  objective?: string;
  expectedImpactSummary?: string;
  sourceResourceId?: string;
  scopeIn?: string;
  scopeOut?: string;
  baselineSummary?: string;
  targetSummary?: string;
  constraintsRisks?: string;
  sustainmentExpectation?: string;
  methodologyVersionId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  priority?: string;
  ownerMembershipId?: string;
  sponsorMembershipId?: string;
  facilitatorMembershipId?: string;
  measures?: Array<{
    key: string;
    name: string;
    unitLabel?: string;
    baseline?: number;
    target?: number;
  }>;
}) {
  try {
    const projectId = await callRpc<string>("create_improvement_project", {
      target_title: input.title,
      target_unit_id: input.unitId,
      ...(input.problemStatement
        ? { target_problem_statement: input.problemStatement }
        : {}),
      ...(input.objective ? { target_objective: input.objective } : {}),
      ...(input.expectedImpactSummary
        ? { target_expected_impact_summary: input.expectedImpactSummary }
        : {}),
      ...(input.sourceResourceId
        ? { target_source_resource_id: input.sourceResourceId }
        : {}),
    });

    await callRpc("update_ci_project_draft", {
      target_project_id: projectId,
      ...(input.scopeIn ? { target_scope_in: input.scopeIn } : {}),
      ...(input.scopeOut ? { target_scope_out: input.scopeOut } : {}),
      ...(input.baselineSummary
        ? { target_baseline_summary: input.baselineSummary }
        : {}),
      ...(input.targetSummary
        ? { target_target_summary: input.targetSummary }
        : {}),
      ...(input.constraintsRisks
        ? { target_constraints_risks: input.constraintsRisks }
        : {}),
      ...(input.sustainmentExpectation
        ? { target_sustainment_expectation: input.sustainmentExpectation }
        : {}),
      ...(input.methodologyVersionId
        ? { target_methodology_version_id: input.methodologyVersionId }
        : {}),
      ...(input.plannedStartDate
        ? { target_planned_start_date: input.plannedStartDate }
        : {}),
      ...(input.plannedEndDate
        ? { target_planned_end_date: input.plannedEndDate }
        : {}),
      ...(input.priority ? { target_priority: input.priority } : {}),
    });

    if (input.ownerMembershipId) {
      await callRpc("assign_ci_project_team_member", {
        target_project_id: projectId,
        target_membership_id: input.ownerMembershipId,
        target_team_role: "owner",
      });
    }

    if (input.sponsorMembershipId) {
      await callRpc("assign_ci_project_team_member", {
        target_project_id: projectId,
        target_membership_id: input.sponsorMembershipId,
        target_team_role: "sponsor",
      });
    }

    if (input.facilitatorMembershipId) {
      await callRpc("assign_ci_project_team_member", {
        target_project_id: projectId,
        target_membership_id: input.facilitatorMembershipId,
        target_team_role: "facilitator",
      });
    }

    for (const measure of input.measures ?? []) {
      await callRpc("create_ci_project_metric", {
        target_project_id: projectId,
        target_metric_key: measure.key,
        target_display_name: measure.name,
        ...(measure.unitLabel ? { target_unit_label: measure.unitLabel } : {}),
        ...(measure.baseline !== undefined
          ? { target_baseline_value: measure.baseline }
          : {}),
        ...(measure.target !== undefined
          ? { target_target_value: measure.target }
          : {}),
      });
    }

    revalidatePath("/platform/projects");
    return projectId;
  } catch (error) {
    throw new Error(mapProjectMutationError(error));
  }
}

export async function updateProjectDraft(input: {
  projectId: string;
  title?: string;
  problemStatement?: string;
  objective?: string;
  expectedImpactSummary?: string;
  scopeIn?: string;
  scopeOut?: string;
  baselineSummary?: string;
  targetSummary?: string;
  constraintsRisks?: string;
  sustainmentExpectation?: string;
  methodologyVersionId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  priority?: string;
}): Promise<ActionResult> {
  try {
    await callRpc("update_ci_project_draft", {
      target_project_id: input.projectId,
      ...(input.title ? { target_title: input.title } : {}),
      ...(input.problemStatement !== undefined
        ? { target_problem_statement: input.problemStatement }
        : {}),
      ...(input.objective !== undefined
        ? { target_objective: input.objective }
        : {}),
      ...(input.expectedImpactSummary !== undefined
        ? { target_expected_impact_summary: input.expectedImpactSummary }
        : {}),
      ...(input.scopeIn !== undefined
        ? { target_scope_in: input.scopeIn }
        : {}),
      ...(input.scopeOut !== undefined
        ? { target_scope_out: input.scopeOut }
        : {}),
      ...(input.baselineSummary !== undefined
        ? { target_baseline_summary: input.baselineSummary }
        : {}),
      ...(input.targetSummary !== undefined
        ? { target_target_summary: input.targetSummary }
        : {}),
      ...(input.constraintsRisks !== undefined
        ? { target_constraints_risks: input.constraintsRisks }
        : {}),
      ...(input.sustainmentExpectation !== undefined
        ? { target_sustainment_expectation: input.sustainmentExpectation }
        : {}),
      ...(input.methodologyVersionId
        ? { target_methodology_version_id: input.methodologyVersionId }
        : {}),
      ...(input.plannedStartDate
        ? { target_planned_start_date: input.plannedStartDate }
        : {}),
      ...(input.plannedEndDate
        ? { target_planned_end_date: input.plannedEndDate }
        : {}),
      ...(input.priority ? { target_priority: input.priority } : {}),
    });
    revalidateProjectPaths(input.projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function assignProjectTeamMember(input: {
  projectId: string;
  membershipId: string;
  teamRole: string;
}): Promise<ActionResult> {
  try {
    await callRpc("assign_ci_project_team_member", {
      target_project_id: input.projectId,
      target_membership_id: input.membershipId,
      target_team_role: input.teamRole,
    });
    revalidateProjectPaths(input.projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function createProjectMetric(input: {
  projectId: string;
  key: string;
  name: string;
  unitLabel?: string;
  baseline?: number;
  target?: number;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_ci_project_metric", {
      target_project_id: input.projectId,
      target_metric_key: input.key,
      target_display_name: input.name,
      ...(input.unitLabel ? { target_unit_label: input.unitLabel } : {}),
      ...(input.baseline !== undefined
        ? { target_baseline_value: input.baseline }
        : {}),
      ...(input.target !== undefined
        ? { target_target_value: input.target }
        : {}),
    });
    revalidateProjectPaths(input.projectId);
    return { ok: true, id };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function submitProject(projectId: string): Promise<ActionResult> {
  try {
    await callRpc("submit_project", { target_project_id: projectId });
    revalidateProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function approveProject(projectId: string): Promise<ActionResult> {
  try {
    await callRpc("approve_project", { target_project_id: projectId });
    revalidateProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function returnProjectToDraft(
  projectId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("return_project_to_draft", {
      target_project_id: projectId,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function startProject(projectId: string): Promise<ActionResult> {
  try {
    await callRpc("start_project", { target_project_id: projectId });
    revalidateProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function completeProjectPhase(
  projectId: string,
  phaseId: string,
  markSkipped = false,
): Promise<ActionResult> {
  try {
    await callRpc("complete_project_phase", {
      target_project_id: projectId,
      target_phase_id: phaseId,
      target_mark_skipped: markSkipped,
    });
    revalidateProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function createProjectAction(input: {
  projectId: string;
  title: string;
  description?: string;
  phaseId?: string;
  priority?: string;
  dueAt?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_project_action", {
      target_title: input.title,
      target_project_id: input.projectId,
      ...(input.phaseId ? { target_project_phase_id: input.phaseId } : {}),
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.priority ? { target_priority: input.priority } : {}),
      ...(input.dueAt ? { target_due_at: input.dueAt } : {}),
    });
    revalidateProjectPaths(input.projectId);
    if (id) {
      revalidatePath(`/platform/actions/${id}`);
      revalidatePath("/platform/actions");
    }
    return { ok: true, id };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function recordMetricMeasurement(input: {
  metricId: string;
  measuredValue: number;
  measuredAt?: string;
  note?: string;
  projectId: string;
}): Promise<ActionResult> {
  try {
    await callRpc("record_metric_measurement", {
      target_metric_id: input.metricId,
      target_measured_value: input.measuredValue,
      ...(input.measuredAt ? { target_measured_at: input.measuredAt } : {}),
      ...(input.note ? { target_note: input.note } : {}),
    });
    revalidateProjectPaths(input.projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function linkCiProjectEvidence(input: {
  projectId: string;
  attachmentId: string;
  phaseId?: string;
}): Promise<ActionResult> {
  try {
    await callRpc("link_ci_project_evidence", {
      target_project_id: input.projectId,
      target_attachment_id: input.attachmentId,
      ...(input.phaseId ? { target_project_phase_id: input.phaseId } : {}),
    });
    revalidateProjectPaths(input.projectId);
    return { ok: true };
  } catch (error) {
    return { error: mapProjectMutationError(error) };
  }
}

export async function initiateProjectEvidenceUpload(
  projectId: string,
  filename: string,
  mimeType: string,
  byteSize: number,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("initiate_attachment_upload", {
    target_resource_id: projectId,
    target_filename: filename,
    target_mime_type: mimeType,
    target_byte_size: byteSize,
  });

  if (error) return { error: mapProjectMutationError(error) };

  const row = (
    data as Array<{ attachment_id: string; storage_object_path: string }>
  )[0];

  if (!row) return { error: "Upload initiation failed" };

  return {
    attachmentId: row.attachment_id,
    storagePath: row.storage_object_path,
  };
}

export async function confirmProjectEvidenceUpload(
  projectId: string,
  attachmentId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_attachment_upload", {
    target_attachment_id: attachmentId,
  });

  if (error) return { error: mapProjectMutationError(error) };

  const linkResult = await linkCiProjectEvidence({
    projectId,
    attachmentId,
  });
  if (linkResult.error) return linkResult;

  revalidateProjectPaths(projectId);
  return {};
}

export async function createCiProjectMethodologyDraft(input: {
  name: string;
  code: string;
  description?: string;
}) {
  const methodologyId = await callRpc<string>(
    "create_ci_project_methodology_draft",
    {
      target_name: input.name,
      target_code: input.code,
      ...(input.description ? { target_description: input.description } : {}),
    },
  );
  revalidatePath("/platform/projects/methodologies");
  return methodologyId;
}

export async function addCiProjectMethodologyPhase(input: {
  methodologyVersionId: string;
  phaseKey: string;
  title: string;
  displayOrder: number;
  description?: string;
}) {
  await callRpc("add_ci_project_methodology_phase", {
    target_methodology_version_id: input.methodologyVersionId,
    target_phase_key: input.phaseKey,
    target_title: input.title,
    target_display_order: input.displayOrder,
    ...(input.description ? { target_description: input.description } : {}),
  });
  revalidatePath("/platform/projects/methodologies");
}

export async function publishCiProjectMethodologyVersion(
  methodologyVersionId: string,
) {
  await callRpc("publish_ci_project_methodology_version", {
    target_methodology_version_id: methodologyVersionId,
  });
  revalidatePath("/platform/projects/methodologies");
}

export async function createCiProjectMethodologySuccessorVersion(
  methodologyId: string,
) {
  const versionId = await callRpc<string>(
    "create_ci_project_methodology_successor_version",
    { target_methodology_id: methodologyId },
  );
  revalidatePath("/platform/projects/methodologies");
  revalidatePath(`/platform/projects/methodologies/${methodologyId}`);
  return versionId;
}
