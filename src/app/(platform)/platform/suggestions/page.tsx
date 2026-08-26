import Link from "next/link";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pipelineStatuses, suggestionStatusLabel } from "@/lib/suggestions/status";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SuggestionsOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const canSubmit = await currentMemberHasPermission("suggestions.submit");
  const canReview = await currentMemberHasPermission("suggestions.review");
  const canManageProgrammes = await currentMemberHasPermission("suggestions.programmes.manage");

  const { data: overview } = await supabase.rpc("get_suggestions_overview");
  const { data: list } = await supabase.rpc("get_suggestions_list", {
    target_page: 1,
    target_page_size: 10,
  });

  const overviewObj = (overview as Record<string, unknown>) ?? {};
  const pipeline = (overviewObj.pipeline as Record<string, number>) ?? {};
  const items =
    ((list as { items?: unknown[] })?.items as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="flex flex-col gap-8" data-testid="suggestions-overview">
      <PageHeader
        title="Suggestions"
        description="Improvement ideas from your people — capture, review, and implement."
        actions={
          <div className="flex gap-2">
            {canSubmit ? (
              <Button size="sm" asChild>
                <Link href="/platform/suggestions/new">New suggestion</Link>
              </Button>
            ) : null}
            {canManageProgrammes ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/suggestions/programmes">Programmes</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Submitted this month"
          value={(overviewObj.submitted_this_month as number) ?? 0}
        />
        <MetricCard
          label="Awaiting review"
          value={(overviewObj.awaiting_review as number) ?? 0}
        />
        <MetricCard label="Implementing" value={(overviewObj.implementing as number) ?? 0} />
        <MetricCard label="Implemented" value={(overviewObj.implemented as number) ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Idea pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {pipelineStatuses().map((status) => (
            <div key={status} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">{suggestionStatusLabel(status)}</p>
              <p className="text-2xl font-semibold tabular-nums">{pipeline[status] ?? 0}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {canReview ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Review queue</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/suggestions/review">Open queue</Link>
            </Button>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id as string}
              href={`/platform/suggestions/${item.id as string}`}
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-surface"
            >
              <span>
                {item.suggestion_number ? `${item.suggestion_number as string} · ` : ""}
                {item.title as string}
              </span>
              <span className="text-muted-foreground">{suggestionStatusLabel(item.status as string)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
