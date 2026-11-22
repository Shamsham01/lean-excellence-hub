"use server";

import { revalidatePath } from "next/cache";

import { mapCiProjectLinkError } from "@/lib/projects/errors";
import { callProjectRpc } from "@/lib/projects/supabase-untyped";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type LinkResult = { error?: string };

function mapLinkError(error: unknown): string {
  return mapCiProjectLinkError(error);
}

export async function linkActionToCiProject(
  actionId: string,
  projectId: string,
): Promise<LinkResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callProjectRpc(
    supabase,
    "link_action_to_ci_project",
    {
      target_action_id: actionId,
      target_project_id: projectId,
    },
  );
  if (error) return { error: mapLinkError(error) };
  revalidatePath(`/platform/actions/${actionId}`);
  revalidatePath(`/platform/projects/${projectId}`);
  revalidatePath("/platform/actions");
  revalidatePath("/platform/projects");
  return {};
}

export async function unlinkActionFromCiProject(
  actionId: string,
): Promise<LinkResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callProjectRpc(
    supabase,
    "unlink_action_from_ci_project",
    { target_action_id: actionId },
  );
  if (error) return { error: mapLinkError(error) };
  revalidatePath(`/platform/actions/${actionId}`);
  revalidatePath("/platform/actions");
  revalidatePath("/platform/projects");
  return {};
}

export async function linkGembaObservationToCiProject(
  observationId: string,
  projectId: string,
  walkId: string,
): Promise<LinkResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callProjectRpc(
    supabase,
    "set_gemba_observation_linked_project",
    {
      target_observation_id: observationId,
      target_project_id: projectId,
    },
  );
  if (error) return { error: mapLinkError(error) };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  revalidatePath(`/platform/projects/${projectId}`);
  return {};
}

export async function unlinkGembaObservationFromCiProject(
  observationId: string,
  walkId: string,
): Promise<LinkResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callProjectRpc(
    supabase,
    "clear_gemba_observation_linked_project",
    { target_observation_id: observationId },
  );
  if (error) return { error: mapLinkError(error) };
  revalidatePath(`/platform/gemba/walks/${walkId}`);
  return {};
}

export async function linkProblemSolvingCaseToCiProject(
  caseId: string,
  projectId: string,
): Promise<LinkResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callProjectRpc(
    supabase,
    "link_problem_solving_case_to_ci_project",
    {
      target_case_id: caseId,
      target_project_id: projectId,
    },
  );
  if (error) return { error: mapLinkError(error) };
  revalidatePath(`/platform/problem-solving/${caseId}`);
  revalidatePath(`/platform/projects/${projectId}`);
  return {};
}

export async function unlinkProblemSolvingCaseFromCiProject(
  caseId: string,
): Promise<LinkResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await callProjectRpc(
    supabase,
    "unlink_problem_solving_case_from_ci_project",
    { target_case_id: caseId },
  );
  if (error) return { error: mapLinkError(error) };
  revalidatePath(`/platform/problem-solving/${caseId}`);
  return {};
}
