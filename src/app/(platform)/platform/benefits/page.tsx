import { BenefitPortfolio } from "@/components/benefits/benefit-portfolio";
import { ModulePageInsightsDeferred } from "@/components/platform/module-page-insights-deferred";
import { BENEFITS_ANALYTICS_ICONS } from "@/components/platform/module-analytics-icons";
import { PageHeader } from "@/components/platform/page-header";
import { parseAnalyticsRangeDays } from "@/modules/platform-analytics/date-range";
import { buildAnalyticsDateRangeForOrganisation } from "@/modules/platform-analytics/date-range.server";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { ModulePortfolioNewLink } from "@/components/billing/module-portfolio-actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { callBenefitRpc } from "@/lib/benefits/supabase-untyped";
import type {
  BenefitsListResponse,
  BenefitsOverview,
} from "@/lib/benefits/types";
import { BENEFITS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function BenefitsPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    benefit_class?: string;
    range?: string;
  }>;
}) {
  const params = await searchParams;
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: BENEFITS_PERMISSIONS.read,
    module: "benefits",
    title: "Benefits",
    denyWithoutAccess: false,
    baselineOpensModule: true,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const analyticsRange = await buildAnalyticsDateRangeForOrganisation(
    parseAnalyticsRangeDays(params.range),
  );
  const canCreate = await currentMemberHasPermission("benefits.create");
  const { data: overviewData } = await callBenefitRpc<BenefitsOverview>(
    supabase,
    "get_benefits_overview",
  );

  const { data: listData } = await callBenefitRpc<BenefitsListResponse>(
    supabase,
    "get_benefits_list",
    {
      target_search: params.search ?? null,
      target_status: params.status ?? null,
      target_benefit_class: params.benefit_class ?? null,
      target_page: 1,
      target_page_size: 25,
    },
  );

  const portfolio = listData ?? {
    items: [],
    total_count: 0,
    page: 1,
    page_size: 25,
  };

  return (
    <div className="flex flex-col gap-8" data-testid="benefits-portfolio-page">
      <PageHeader
        title="Benefits"
        actions={
          <div className="flex gap-2">
            {canCreate ? (
              <ModulePortfolioNewLink
                href="/platform/benefits/new"
                testId="benefits-new-link"
              >
                New benefit
              </ModulePortfolioNewLink>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <AppLink
                href="/platform/benefits/validation"
                data-testid="benefits-validation-link"
              >
                Validation queue
              </AppLink>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <AppLink
                href="/platform/benefits/categories"
                data-testid="benefits-categories-link"
              >
                Categories
              </AppLink>
            </Button>
          </div>
        }
      />
      <BenefitPortfolio
        items={portfolio.items}
        totalCount={portfolio.total_count}
        overview={overviewData}
        statusFilter={params.status ?? null}
        searchFilter={params.search ?? null}
        benefitClassFilter={params.benefit_class ?? null}
        canCreate={canCreate}
      />
      <ModulePageInsightsDeferred
        module="benefits"
        analyticsRange={analyticsRange}
        icons={BENEFITS_ANALYTICS_ICONS}
        testId="benefits-analytics"
        donutCenterLabel="Benefits"
        showAgeingTable={false}
      />
      <WorkplaceSharedRecords module="benefits" />
    </div>
  );
}
