import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { CreateBenefitWizard } from "@/components/benefits/create-benefit-wizard";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { untypedFrom } from "@/lib/benefits/supabase-untyped";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewBenefitPage() {
  const canCreate = await currentMemberHasPermission("benefits.create");
  if (!canCreate) notFound();

  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });

  const { data: categoryRows } = await untypedFrom(
    supabase,
    "benefit_categories",
  )
    .select("id, name, code, status")
    .eq("status", "active")
    .order("display_order");

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-6"
      data-testid="create-benefit-page"
    >
      <PageHeader
        title="New improvement benefit"
        description="Define classification, baseline, forecast, and source links before submission."
      />
      <CreateBenefitWizard
        units={selectorOptions.units}
        members={selectorOptions.people}
        requiresSiteSelection={selectorOptions.requiresSiteSelection}
        categories={
          (
            categoryRows as Array<{
              id: string;
              name: string;
              code: string;
            }> | null
          )?.map((category) => ({
            id: category.id,
            label: `${category.name} (${category.code})`,
          })) ?? []
        }
      />
    </div>
  );
}
