import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import {
  ReviewQueueList,
  ReviewQueueTabs,
} from "@/components/suggestions/review-queue-list";
import { ReviewWorkspace } from "@/components/suggestions/review-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { fetchSuggestionPortfolio } from "@/lib/suggestions/fetch-suggestion-portfolio";
import { fetchSuggestionReviewContext } from "@/lib/suggestions/fetch-suggestion-review-context";
import { parseSuggestionReviewQueueSearchParams } from "@/lib/suggestions/review-queue-query";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SuggestionReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const canReview = await currentMemberHasPermission("suggestions.review");
  const canManage = await currentMemberHasPermission("suggestions.manage");

  if (!canReview && !canManage) {
    notFound();
  }

  const params = await searchParams;
  const queueState = parseSuggestionReviewQueueSearchParams(params);
  const supabase = await createServerSupabaseClient();

  const portfolio = await fetchSuggestionPortfolio(supabase, {
    q: null,
    status: null,
    programme: null,
    category: null,
    originUnit: null,
    reviewer: queueState.queue,
    sort: "newest",
    page: queueState.page,
    pageSize: 25,
  });

  const selectedSuggestionId =
    queueState.suggestionId ?? portfolio.items[0]?.id ?? null;

  const reviewContext = selectedSuggestionId
    ? await fetchSuggestionReviewContext(supabase, selectedSuggestionId)
    : null;

  return (
    <div className="flex flex-col gap-6" data-testid="suggestion-review-queue">
      <PageHeader
        title="Suggestion review"
        description="Claim, assess, and decide improvement ideas in your jurisdiction."
      />

      <ReviewQueueTabs
        queue={queueState.queue}
        selectedSuggestionId={selectedSuggestionId}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ReviewQueueList
          items={portfolio.items}
          totalCount={portfolio.total_count}
          page={portfolio.page}
          pageSize={portfolio.page_size}
          queue={queueState.queue}
          selectedSuggestionId={selectedSuggestionId}
        />

        {reviewContext ? (
          <ReviewWorkspace context={reviewContext} />
        ) : (
          <Card data-testid="review-workspace-empty">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Select a suggestion from the queue to review it.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
