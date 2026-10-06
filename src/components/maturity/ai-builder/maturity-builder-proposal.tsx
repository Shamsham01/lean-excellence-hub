"use client";

import { ChevronDown, PencilLine, Sparkles } from "lucide-react";
import type { RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  MaturityBuilderCurrentProposal,
  MaturityBuilderFocus,
} from "@/modules/maturity/ai-builder/types";
import { scopeTypeLabel } from "@/modules/maturity/semantic-scope";

export type MaturityBuilderRefineTarget = {
  focus: MaturityBuilderFocus;
  label: string;
};

export function MaturityBuilderProposal({
  current,
  headingRef,
  disabled,
  onRefine,
}: {
  current: MaturityBuilderCurrentProposal;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  disabled: boolean;
  onRefine: (target: MaturityBuilderRefineTarget) => void;
}) {
  const { proposal, counts, revision, changeSummary } = current;

  return (
    <article
      className="flex min-w-0 flex-col gap-5"
      aria-labelledby="maturity-builder-proposal-title"
      data-testid="maturity-builder-proposal"
      data-revision={revision}
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="warning"
            data-testid="maturity-builder-proposal-badge"
          >
            <Sparkles className="mr-1 size-3" aria-hidden="true" />
            LeanAI proposal · not saved
          </Badge>
          <Badge variant="outline" data-testid="maturity-builder-revision">
            Revision {revision}
          </Badge>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2
              id="maturity-builder-proposal-title"
              ref={headingRef}
              tabIndex={-1}
              className="min-w-0 text-lg font-semibold tracking-tight break-words outline-none sm:text-xl"
              data-testid="maturity-builder-proposal-name"
            >
              {proposal.name}
            </h2>
            <RefineButton
              label="framework name and description"
              disabled={disabled}
              onClick={() =>
                onRefine({
                  focus: { kind: "framework" },
                  label: "the framework name and description",
                })
              }
              testId="maturity-builder-refine-framework"
            />
          </div>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {proposal.description}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Assessment scope:
            </span>{" "}
            {proposal.assessmentScopes.map(scopeTypeLabel).join(", ")}
          </p>
        </div>
      </header>

      {revision > 1 && changeSummary.length > 0 ? (
        <section
          className="rounded-lg border border-information/30 bg-information/10 px-4 py-3"
          aria-labelledby="maturity-builder-changes-title"
          data-testid="maturity-builder-change-summary"
        >
          <h3
            id="maturity-builder-changes-title"
            className="text-sm font-semibold text-foreground"
          >
            What changed in revision {revision}
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground">
            {changeSummary.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl
        className="grid grid-cols-2 gap-2 @lg:grid-cols-4"
        data-testid="maturity-builder-proposal-counts"
      >
        <Stat label="Levels" value={counts.levels} />
        <Stat label="Pillars" value={counts.pillars} />
        <Stat label="Criteria" value={counts.criteria} />
        <Stat label="Questions" value={counts.questions} />
      </dl>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="maturity-builder-levels-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="maturity-builder-levels-title"
            className="text-sm font-semibold text-foreground"
          >
            Maturity levels
          </h3>
          <RefineButton
            label="maturity levels"
            disabled={disabled}
            onClick={() =>
              onRefine({
                focus: { kind: "levels" },
                label: "the maturity levels",
              })
            }
            testId="maturity-builder-refine-levels"
          />
        </div>
        <ol
          className="grid gap-2 @xl:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]"
          data-testid="maturity-builder-levels"
        >
          {proposal.levels.map((level, index) => (
            <li
              key={level.name}
              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2.5"
              style={{
                borderTopWidth: "4px",
                borderTopColor: `var(--maturity-${index + 1})`,
              }}
            >
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                Level {index + 1}
              </p>
              <p className="font-medium break-words text-foreground">
                {level.name}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {level.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="maturity-builder-pillars-title"
      >
        <h3
          id="maturity-builder-pillars-title"
          className="text-sm font-semibold text-foreground"
        >
          Pillars, criteria and scored questions
        </h3>
        <ol
          className="flex flex-col gap-2"
          data-testid="maturity-builder-pillars"
        >
          {proposal.pillars.map((pillar, pillarIndex) => {
            const questionCount = pillar.criteria.reduce(
              (total, criterion) => total + criterion.questions.length,
              0,
            );
            return (
              <li key={pillar.name} className="min-w-0">
                <details
                  className="group rounded-lg border border-border bg-card"
                  open={pillarIndex === 0}
                  data-testid={`maturity-builder-pillar-${pillarIndex}`}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground tabular-nums">
                      {pillarIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words text-foreground">
                        {pillar.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {pillar.criteria.length}{" "}
                        {pillar.criteria.length === 1
                          ? "criterion"
                          : "criteria"}{" "}
                        · {questionCount}{" "}
                        {questionCount === 1 ? "question" : "questions"}
                      </span>
                    </span>
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        {pillar.description ? (
                          <p className="text-sm text-muted-foreground">
                            {pillar.description}
                          </p>
                        ) : null}
                        {pillar.guidance ? (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Guidance:</span>{" "}
                            {pillar.guidance}
                          </p>
                        ) : null}
                      </div>
                      <RefineButton
                        label={`pillar ${pillar.name}`}
                        disabled={disabled}
                        onClick={() =>
                          onRefine({
                            focus: { kind: "pillar", pillarIndex },
                            label: `pillar “${pillar.name}”`,
                          })
                        }
                        testId={`maturity-builder-refine-pillar-${pillarIndex}`}
                      />
                    </div>
                    <ol className="flex flex-col gap-2">
                      {pillar.criteria.map((criterion, criterionIndex) => (
                        <li
                          key={criterion.name}
                          className="min-w-0 border-l-2 border-border pl-3"
                          data-testid={`maturity-builder-criterion-${pillarIndex}-${criterionIndex}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium break-words text-foreground">
                                {criterion.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {criterion.description}
                              </p>
                            </div>
                            <RefineButton
                              label={`criterion ${criterion.name}`}
                              disabled={disabled}
                              compact
                              onClick={() =>
                                onRefine({
                                  focus: {
                                    kind: "criterion",
                                    pillarIndex,
                                    criterionIndex,
                                  },
                                  label: `criterion “${criterion.name}”`,
                                })
                              }
                              testId={`maturity-builder-refine-criterion-${pillarIndex}-${criterionIndex}`}
                            />
                          </div>
                          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-foreground marker:text-muted-foreground">
                            {criterion.questions.map((question) => (
                              <li key={question.prompt}>{question.prompt}</li>
                            ))}
                          </ol>
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function RefineButton({
  label,
  disabled,
  onClick,
  testId,
  compact = false,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={compact ? "min-h-9 shrink-0 px-2" : "shrink-0"}
      disabled={disabled}
      onClick={onClick}
      aria-label={`Refine ${label}`}
      data-testid={testId}
    >
      <PencilLine className="size-3.5" aria-hidden="true" />
      Refine
    </Button>
  );
}
