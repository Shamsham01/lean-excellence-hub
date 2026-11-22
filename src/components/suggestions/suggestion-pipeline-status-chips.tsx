import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { suggestionPortfolioHref } from "@/lib/suggestions/suggestion-portfolio-query";
import {
  pipelineStatuses,
  suggestionStatusLabel,
} from "@/lib/suggestions/status";
import { cn } from "@/lib/utils";

export function SuggestionPipelineStatusChips({
  pipeline,
  activeStatus,
}: {
  pipeline: Record<string, number>;
  activeStatus?: string | null;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="suggestion-pipeline-status-chips"
      role="group"
      aria-label="Filter by pipeline status"
    >
      <AppLink
        href={suggestionPortfolioHref({})}
        className={cn(
          "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition",
          !activeStatus
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted/50",
        )}
        data-testid="suggestion-pipeline-chip-all"
      >
        All
      </AppLink>
      {pipelineStatuses().map((status) => {
        const count = pipeline[status] ?? 0;
        const selected = activeStatus === status;
        return (
          <AppLink
            key={status}
            href={suggestionPortfolioHref({ status })}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50",
            )}
            data-testid={`suggestion-pipeline-chip-${status}`}
          >
            {suggestionStatusLabel(status)}
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          </AppLink>
        );
      })}
    </div>
  );
}
