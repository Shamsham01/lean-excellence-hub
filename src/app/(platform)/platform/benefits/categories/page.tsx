import { notFound } from "next/navigation";

import { BenefitCategoryManagement } from "@/components/benefits/benefit-category-management";
import { PageHeader } from "@/components/platform/page-header";
import { untypedFrom } from "@/lib/benefits/supabase-untyped";
import type {
  BenefitCategoryRow,
  BenefitReportingSettingsRow,
} from "@/lib/benefits/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function BenefitCategoriesPage() {
  const canManage = await currentMemberHasPermission(
    "benefits.categories.manage",
  );
  if (!canManage) notFound();

  const supabase = await createServerSupabaseClient();

  const { data: categories } = await untypedFrom(supabase, "benefit_categories")
    .select("id, code, name, description, status, display_order")
    .order("display_order");

  const { data: settingsRows } = await untypedFrom(
    supabase,
    "benefit_reporting_settings",
  )
    .select("organisation_id, fiscal_year_start_month")
    .limit(1);

  const reportingSettings =
    (settingsRows as BenefitReportingSettingsRow[] | null)?.[0] ?? null;

  return (
    <div className="flex flex-col gap-6" data-testid="benefit-categories-page">
      <PageHeader
        title="Benefit categories"
        description="Organise benefits and configure fiscal reporting settings."
      />
      <BenefitCategoryManagement
        categories={(categories as BenefitCategoryRow[]) ?? []}
        reportingSettings={reportingSettings}
      />
    </div>
  );
}
