import "server-only";

import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function assertCanEditCaseDefinition(
  caseId: string,
): Promise<{ ok: true } | { error: string }> {
  const canManage = await currentMemberHasPermission("problem_solving.manage");
  if (canManage) {
    return { ok: true };
  }

  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (organisation) => organisation.selected,
  )?.membership_id;
  if (!currentMembershipId) {
    return { error: "Case definition edits are not authorised." };
  }

  const supabase = await createServerSupabaseClient();
  const detailResult = await callProblemSolvingRpc<ProblemSolvingCaseDetail>(
    supabase,
    "get_problem_solving_detail",
    { target_case_id: caseId },
  );
  if (detailResult.error || !detailResult.data) {
    return { error: "Problem solving case not found." };
  }
  if (detailResult.data.owner_membership_id !== currentMembershipId) {
    return { error: "Case definition edits are not authorised." };
  }
  return { ok: true };
}