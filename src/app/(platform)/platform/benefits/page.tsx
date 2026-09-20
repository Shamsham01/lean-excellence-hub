import { BenefitPortfolio } from "@/components/benefits/benefit-portfolio";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { callBenefitRpc } from "@/lib/benefits/supabase-untyped";
import type {
  BenefitsListResponse,
  BenefitsOverview,
} from "@/lib/benefits/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function BenefitsPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    benefit_class?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
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
        description="Forecast, validate, and track improvement benefits across the portfolio."
        actions={
          <div className="flex gap-2">
            {canCreate ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/benefits/new"
                  data-testid="benefits-new-link"
                >
                  New benefit
                </AppLink>
              </Button>
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
    </div>
  );
}
