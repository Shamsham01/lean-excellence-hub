import { notFound } from "next/navigation";

import { ModulePageInsightsDeferred } from "@/components/platform/module-page-insights-deferred";
import { SUGGESTION_ANALYTICS_ICONS } from "@/components/platform/module-analytics-icons";
import { PageHeader } from "@/components/platform/page-header";
import { parseAnalyticsRangeDays } from "@/modules/platform-analytics/date-range";
import { buildAnalyticsDateRangeForOrganisation } from "@/modules/platform-analytics/date-range.server";
import { SuggestionContributorAccess } from "@/components/suggestions/suggestion-contributor-access";
import { SuggestionPipelineStatusChips } from "@/components/suggestions/suggestion-pipeline-status-chips";
import { SuggestionPortfolio } from "@/components/suggestions/suggestion-portfolio";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { NewSuggestionDialog } from "@/components/suggestions/new-suggestion-dialog";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  fetchSuggestionPortfolio,
  fetchSuggestionsOverview,
  loadSuggestionPortfolioFilterOptions,
} from "@/lib/suggestions/fetch-suggestion-portfolio";
import { parseSuggestionPortfolioSearchParams } from "@/lib/suggestions/suggestion-portfolio-query";
import { suggestionAccessMode } from "@/lib/suggestions/suggestion-access-mode";
import { suggestionsOverviewPermissionKeys } from "@/lib/suggestions/suggestion-page-permission-keys";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
  prefetchMemberGrantPermissions,
  prefetchMemberPermissions,
} from "@/modules/platform-shell/permissions";
import { WORKPLACE_VIEW_PERMISSION } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SuggestionsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await Promise.all([
    prefetchMemberPermissions([
      ...suggestionsOverviewPermissionKeys,
      WORKPLACE_VIEW_PERMISSION,
    ]),
    prefetchMemberGrantPermissions(["suggestions.read"]),
  ]);
  const [canReadPortfolio, canSubmit, canViewWorkplace] = await Promise.all([
    currentMemberHasGrantPermission("suggestions.read"),
    currentMemberHasPermission("suggestions.submit"),
    currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION),
  ]);
  const accessMode = suggestionAccessMode({
    canReadPortfolio,
    canSubmit,
    canViewWorkplace,
  });
  if (accessMode === "denied") notFound();
  if (accessMode === "contributor") {
    return (
      <SuggestionContributorAccess
        canSubmit={canSubmit}
        canViewWorkplace={canViewWorkplace}
      />
    );
  }

  const params = await searchParams;
  const filters = parseSuggestionPortfolioSearchParams(params);
  const supabase = await createServerSupabaseClient();
  const analyticsRange = await buildAnalyticsDateRangeForOrganisation(
    parseAnalyticsRangeDays(params.range),
  );
  const canReview = await currentMemberHasPermission("suggestions.review");
  const canManageProgrammes = await currentMemberHasPermission(
    "suggestions.programmes.manage",
  );
  const canManageReview =
    await currentMemberHasPermission("suggestions.manage");

  const [overview, portfolio, filterOptions] = await Promise.all([
    fetchSuggestionsOverview(supabase),
    fetchSuggestionPortfolio(supabase, filters),
    loadSuggestionPortfolioFilterOptions(supabase, {
      programme: filters.programme,
      category: filters.category,
      originUnit: filters.originUnit,
    }),
  ]);

  const pipeline = overview.pipeline;
  const reviewQueueCount = overview.awaiting_review ?? 0;
  const canManageJobFunctions = await currentMemberHasPermission(
    "job_functions.manage",
  );
  const newDialogRequested =
    (Array.isArray(params.new) ? params.new[0] : params.new) === "1";

  return (
    <div className="flex flex-col gap-8" data-testid="suggestions-overview">
      <PageHeader
        title="Suggestions"
        actions={
          <div className="flex flex-wrap gap-2">
            {canReview || canManageReview ? (
              <Button size="sm" variant="outline" asChild>
                <AppLink
                  href="/platform/suggestions/review?queue=mine"
                  data-testid="suggestions-open-queue-link"
                >
                  Review queue ({reviewQueueCount})
                </AppLink>
              </Button>
            ) : null}
            {canSubmit ? (
              <NewSuggestionDialog
                canManageProgrammes={canManageProgrammes}
                canManageJobFunctions={canManageJobFunctions}
                defaultOpen={newDialogRequested}
              />
            ) : null}
            {canManageProgrammes ? (
              <Button size="sm" variant="outline" asChild>
                <AppLink
                  href="/platform/suggestions/programmes"
                  data-testid="suggestions-programmes-link"
                >
                  Programmes
                </AppLink>
              </Button>
            ) : null}
          </div>
        }
      />

      <SuggestionPipelineStatusChips
        pipeline={pipeline}
        activeStatus={filters.status}
      />

      <SuggestionPortfolio
        items={portfolio.items}
        totalCount={portfolio.total_count}
        page={portfolio.page}
        pageSize={portfolio.page_size}
        filters={filters}
        filterOptions={filterOptions}
        showReviewerWorkflow={canReview || canManageReview}
      />

      <ModulePageInsightsDeferred
        module="suggestions"
        analyticsRange={analyticsRange}
        icons={SUGGESTION_ANALYTICS_ICONS}
        testId="suggestions-analytics"
      />
      {canViewWorkplace ? (
        <WorkplaceSharedRecords module="suggestions" />
      ) : null}
    </div>
  );
}
