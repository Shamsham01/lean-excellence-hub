import { notFound } from "next/navigation";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { SuggestionContributorAccess } from "@/components/suggestions/suggestion-contributor-access";
import { SuggestionPortfolio } from "@/components/suggestions/suggestion-portfolio";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
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
  pipelineStatuses,
  suggestionStatusLabel,
} from "@/lib/suggestions/status";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
  prefetchMemberPermissions,
} from "@/modules/platform-shell/permissions";
import { WORKPLACE_VIEW_PERMISSION } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SuggestionsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await prefetchMemberPermissions([
    ...suggestionsOverviewPermissionKeys,
    WORKPLACE_VIEW_PERMISSION,
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

  return (
    <div className="flex flex-col gap-8" data-testid="suggestions-overview">
      <PageHeader
        title="Suggestions"
        description="Improvement ideas from your people — capture, review, and implement."
        actions={
          <div className="flex gap-2">
            {canSubmit ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/suggestions/new"
                  data-testid="suggestions-new-link"
                >
                  New suggestion
                </AppLink>
              </Button>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Submitted this month"
          value={overview.submitted_this_month}
        />
        <MetricCard label="Awaiting review" value={overview.awaiting_review} />
        <MetricCard label="Implementing" value={overview.implementing} />
        <MetricCard label="Implemented" value={overview.implemented} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Idea pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {pipelineStatuses().map((status) => (
            <div
              key={status}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <p className="text-xs text-muted-foreground">
                {suggestionStatusLabel(status)}
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {pipeline[status] ?? 0}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {canReview || canManageReview ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Review queue</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/suggestions/review?queue=mine"
                data-testid="suggestions-open-queue-link"
              >
                Open queue
              </AppLink>
            </Button>
          </CardHeader>
        </Card>
      ) : null}

      <SuggestionPortfolio
        items={portfolio.items}
        totalCount={portfolio.total_count}
        page={portfolio.page}
        pageSize={portfolio.page_size}
        filters={filters}
        filterOptions={filterOptions}
        showReviewerWorkflow={canReview || canManageReview}
      />
      {canViewWorkplace ? (
        <WorkplaceSharedRecords module="suggestions" title="Suggestions" />
      ) : null}
    </div>
  );
}
