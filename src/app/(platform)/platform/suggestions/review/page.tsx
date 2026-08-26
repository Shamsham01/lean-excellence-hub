import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { ReviewWorkspace } from "@/components/suggestions/review-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { suggestionStatusLabel } from "@/lib/suggestions/status";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SuggestionReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ suggestionId?: string }>;
}) {
  const { suggestionId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: queue } = await supabase.rpc("get_suggestion_review_queue");
  const items =
    ((queue as { items?: unknown[] })?.items as Array<Record<string, unknown>>) ?? [];

  const selected =
    suggestionId != null
      ? items.find((item) => item.id === suggestionId) ??
        ((
          await supabase.rpc("get_suggestion_detail", {
            target_suggestion_id: suggestionId,
          })
        ).data as Record<string, unknown> | null)
      : null;

  return (
    <div className="flex flex-col gap-6" data-testid="suggestion-review-queue">
      <PageHeader title="Awaiting review" description="Ideas in your review jurisdiction." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions awaiting review.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id as string}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{item.title as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category_name as string} · {item.origin_unit_name as string}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {suggestionStatusLabel(item.status as string)}
                    </span>
                    <Button
                      size="sm"
                      variant={suggestionId === item.id ? "default" : "outline"}
                      asChild
                    >
                      <Link href={`/platform/suggestions/review?suggestionId=${item.id as string}`}>
                        Review
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {selected ? (
          <ReviewWorkspace
            suggestion={{
              id: selected.id as string,
              title: selected.title as string,
              status: selected.status as string,
              problem_or_opportunity: (selected.problem_or_opportunity as string | null) ?? null,
              proposed_idea: (selected.proposed_idea as string | null) ?? null,
              category_name: (selected.category_name as string | null) ??
                (selected.category_name_snapshot as string | null) ??
                null,
              origin_unit_name: (selected.origin_unit_name as string | null) ??
                (selected.origin_unit_name_snapshot as string | null) ??
                null,
            }}
          />
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Select a suggestion from the queue to record your review.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
