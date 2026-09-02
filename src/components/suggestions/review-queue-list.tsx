"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  suggestionReviewQueueHref,
  type SuggestionReviewQueueMode,
} from "@/lib/suggestions/review-queue-query";
import { formatPortfolioReviewerLabel } from "@/lib/suggestions/reviewer-labels";
import {
  formatSuggestionReference,
  suggestionStatusBadgeVariant,
  suggestionStatusLabel,
} from "@/lib/suggestions/status";
import type { SuggestionPortfolioItem } from "@/lib/suggestions/types";

type ReviewQueueListProps = {
  items: SuggestionPortfolioItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  queue: SuggestionReviewQueueMode;
  selectedSuggestionId: string | null;
};

function formatSubmittedDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB");
}

function QueueItem({
  item,
  queue,
  selected,
}: {
  item: SuggestionPortfolioItem;
  queue: SuggestionReviewQueueMode;
  selected: boolean;
}) {
  const reference = formatSuggestionReference(
    item.suggestion_number,
    item.status,
  );
  const reviewerLabel = formatPortfolioReviewerLabel(item);
  const assignmentLabel =
    queue === "mine" && item.is_active_reviewer
      ? reviewerLabel
      : queue === "unassigned"
        ? "Unassigned"
        : reviewerLabel;

  return (
    <Link
      href={suggestionReviewQueueHref({
        queue,
        suggestionId: item.id,
      })}
      className={`block rounded-lg border p-3 transition-colors ${
        selected
          ? "border-primary bg-accent/40"
          : "border-border hover:border-primary/40 hover:bg-muted/30"
      }`}
      data-testid={`review-queue-item-${item.id}`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">{reference}</p>
          <p className="mt-1 font-medium">{item.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.origin_unit_name_snapshot ?? "—"}
            {item.category_name_snapshot
              ? ` · ${item.category_name_snapshot}`
              : ""}
          </p>
          {assignmentLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {assignmentLabel}
            </p>
          ) : null}
        </div>
        <Badge variant={suggestionStatusBadgeVariant(item.status)}>
          {suggestionStatusLabel(item.status)}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
        Submitted {formatSubmittedDate(item.submitted_at)}
      </p>
    </Link>
  );
}

export function ReviewQueueList({
  items,
  totalCount,
  page,
  pageSize,
  queue,
  selectedSuggestionId,
}: ReviewQueueListProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <Card data-testid="review-queue-list">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base">Queue</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalCount} suggestion{totalCount === 1 ? "" : "s"}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {items.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
            data-testid="review-queue-empty"
          >
            {queue === "mine"
              ? "No suggestions are currently assigned to you."
              : "No unassigned suggestions are available in your jurisdiction."}
          </p>
        ) : (
          items.map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              queue={queue}
              selected={selectedSuggestionId === item.id}
            />
          ))
        )}

        {totalCount > 0 ? (
          <div
            className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
            data-testid="review-queue-pagination"
          >
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {totalCount}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                asChild={page > 1}
                disabled={page <= 1}
                data-testid="review-queue-previous"
              >
                {page > 1 ? (
                  <Link
                    href={suggestionReviewQueueHref({
                      queue,
                      suggestionId: selectedSuggestionId,
                      page: page - 1,
                    })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                asChild={page < totalPages}
                disabled={page >= totalPages}
                data-testid="review-queue-next"
              >
                {page < totalPages ? (
                  <Link
                    href={suggestionReviewQueueHref({
                      queue,
                      suggestionId: selectedSuggestionId,
                      page: page + 1,
                    })}
                  >
                    Next
                  </Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReviewQueueTabs({
  queue,
  selectedSuggestionId,
}: {
  queue: SuggestionReviewQueueMode;
  selectedSuggestionId: string | null;
}) {
  const tabs: Array<{ value: SuggestionReviewQueueMode; label: string }> = [
    { value: "mine", label: "My reviews" },
    { value: "unassigned", label: "Unassigned" },
  ];

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Review queue"
      data-testid="review-queue-tabs"
    >
      {tabs.map((tab) => {
        const active = queue === tab.value;
        return (
          <Button
            key={tab.value}
            variant={active ? "default" : "outline"}
            size="sm"
            className="min-h-11"
            asChild
          >
            <Link
              href={suggestionReviewQueueHref({
                queue: tab.value,
                suggestionId: active ? selectedSuggestionId : null,
                page: 1,
              })}
              role="tab"
              aria-selected={active}
              data-testid={`review-queue-tab-${tab.value}`}
            >
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
