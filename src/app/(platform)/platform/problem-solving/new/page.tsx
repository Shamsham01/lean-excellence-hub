import { notFound } from "next/navigation";

import { CreateCaseWizard } from "@/components/problem-solving/create-case-wizard";
import { PageHeader } from "@/components/platform/page-header";
import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import type { ProblemSolvingMethodsResponse } from "@/lib/problem-solving/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewProblemSolvingCasePage() {
  const canCreate = await currentMemberHasPermission("problem_solving.create");
  if (!canCreate) notFound();

  const supabase = await createServerSupabaseClient();
  await callProblemSolvingRpc(
    supabase,
    "ensure_problem_solving_methods_provisioned",
  );

  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  const { data: memberships } = await supabase
    .from("organisation_memberships")
    .select("id, display_name, job_title")
    .eq("status", "active")
    .order("display_name");

  const { data: methodsData } =
    await callProblemSolvingRpc<ProblemSolvingMethodsResponse>(
      supabase,
      "get_problem_solving_methods",
    );

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-6"
      data-testid="create-problem-solving-page"
    >
      <PageHeader
        title="New problem solving case"
        description="Define the problem, scope, and method before activation."
      />
      <CreateCaseWizard
        units={units?.map((unit) => ({ id: unit.id, name: unit.name })) ?? []}
        members={
          memberships?.map((membership) => ({
            id: membership.id,
            label:
              membership.display_name ??
              membership.job_title ??
              membership.id.slice(0, 8),
          })) ?? []
        }
        methods={methodsData?.items ?? []}
      />
    </div>
  );
}
