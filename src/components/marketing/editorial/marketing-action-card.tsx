import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

type ChipTone = "neutral" | "accent" | "connected" | "warning" | "success";

export type MarketingActionCardProps = {
  actionRef: string;
  title: string;
  owner: string;
  due: string;
  status: string;
  statusTone?: ChipTone;
  sourceModule: string;
  sourceRef: string;
  sourceTitle: string;
  siteLine?: string;
  leanAiSuggestion?: ReactNode;
  validationNote?: string;
  variant?: "hero" | "story" | "inline";
  className?: string;
  id?: string;
};

export function MarketingActionCard({
  actionRef,
  title,
  owner,
  due,
  status,
  statusTone = "accent",
  sourceModule,
  sourceRef,
  sourceTitle,
  siteLine = "Harbourfield Foods Group · Bodmin Bakery · Packing Line 1",
  leanAiSuggestion,
  validationNote,
  variant = "story",
  className,
  id,
}: MarketingActionCardProps) {
  const isHero = variant === "hero";

  return (
    <article
      id={id}
      className={cn(
        "editorial-action-card",
        isHero && "editorial-action-card-hero",
        variant === "inline" && "editorial-action-card-inline",
        className,
      )}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <div className="editorial-action-card-shell">
        <div className="editorial-action-card-chrome">
          <span
            className="editorial-dots inline-flex gap-[0.3rem]"
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <p className="editorial-action-card-route">
            /platform/actions · {actionRef}
          </p>
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            <StatusChip tone={statusTone}>{status}</StatusChip>
            <StatusChip>Example</StatusChip>
          </div>
        </div>

        <div className="editorial-action-card-body">
          <p className="editorial-action-card-kicker">{siteLine}</p>
          <h2
            id={id ? `${id}-title` : undefined}
            className="editorial-action-card-title"
          >
            <span className="editorial-action-card-ref">{actionRef}</span>
            {title}
          </h2>

          <dl className="editorial-action-card-meta">
            <div>
              <dt>Owner</dt>
              <dd>{owner}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{due}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <span className="editorial-action-card-source-module">
                  {sourceModule}
                </span>
                <span aria-hidden="true"> · </span>
                <span className="font-medium text-foreground">{sourceRef}</span>
                <span className="block text-[0.8rem] font-normal text-muted-foreground">
                  {sourceTitle}
                </span>
              </dd>
            </div>
          </dl>

          {leanAiSuggestion ? (
            <Card className="editorial-action-card-leanai gap-2 border-primary/25 bg-[color-mix(in_oklab,var(--accent)_48%,var(--card))] p-3.5 shadow-none sm:p-4">
              <CardHeader className="gap-1 p-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xs font-semibold sm:text-sm">
                    LeanAI · suggestion
                  </CardTitle>
                  <StatusChip tone="accent">Review</StatusChip>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 p-0">
                <div className="text-[0.8125rem] leading-relaxed text-foreground">
                  {leanAiSuggestion}
                </div>
                <p className="m-0 text-[0.7rem] leading-normal text-muted-foreground">
                  A person chooses whether to apply this in the workflow.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {validationNote ? (
            <p className="editorial-action-card-validation">{validationNote}</p>
          ) : null}
        </div>
      </div>
      <p className="marketing-preview-aux-note">
        Example data · fictional site
      </p>
    </article>
  );
}
