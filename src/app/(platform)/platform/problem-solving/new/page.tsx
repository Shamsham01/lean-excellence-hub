import { notFound } from "next/navigation";

import { CreateCaseWizard } from "@/components/problem-solving/create-case-wizard";
import { PageHeader } from "@/components/platform/page-header";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import type { ProblemSolvingMethodsResponse } from "@/lib/problem-solving/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewProblemSolvingCasePage() {
  const canCreate = await currentMemberHasPermission("problem_solving.create");
  if (!canCreate) notFound();

  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });
  await callProblemSolvingRpc(
    supabase,
    "ensure_problem_solving_methods_provisioned",
  );

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
        units={selectorOptions.units}
        members={selectorOptions.people}
        requiresSiteSelection={selectorOptions.requiresSiteSelection}
        methods={methodsData?.items ?? []}
      />
    </div>
  );
}
