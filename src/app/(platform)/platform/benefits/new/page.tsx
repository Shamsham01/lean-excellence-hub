import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { CreateBenefitWizard } from "@/components/benefits/create-benefit-wizard";
import { untypedFrom } from "@/lib/benefits/supabase-untyped";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewBenefitPage() {
  const canCreate = await currentMemberHasPermission("benefits.create");
  if (!canCreate) notFound();

  const supabase = await createServerSupabaseClient();

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
