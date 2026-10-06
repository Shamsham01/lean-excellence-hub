import { CheckCircle2, Circle } from "lucide-react";

import type { MaturityBuilderUnderstanding } from "@/modules/maturity/ai-builder/types";

const ROWS: Array<{ key: keyof MaturityBuilderUnderstanding; label: string }> =
  [
    { key: "assessmentPurpose", label: "What it assesses" },
    { key: "assessmentScope", label: "Assessment scope" },
    { key: "pillars", label: "Pillars" },
    { key: "levelPhilosophy", label: "Maturity levels" },
    { key: "existingStandards", label: "Existing standards" },
    { key: "suggestionAreas", label: "Where LEH can suggest" },
    { key: "existingFramework", label: "Existing framework" },
  ];

export function MaturityBuilderUnderstandingPanel({
  understanding,
}: {
  understanding: MaturityBuilderUnderstanding | null;
}) {
  const known = ROWS.filter((row) => understanding?.[row.key]).length;

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="maturity-builder-understanding-title"
      data-testid="maturity-builder-understanding"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="maturity-builder-understanding-title"
          className="text-sm font-semibold text-foreground"
        >
          What LeanAI understands so far
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {known} of {ROWS.length} covered
        </p>
      </div>
      <dl className="grid gap-2 @md:grid-cols-2">
        {ROWS.map((row) => {
          const value = understanding?.[row.key] ?? null;
          return (
            <div
              key={row.key}
              className="flex min-w-0 gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              {value ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">
                  {row.label}
                </dt>
                <dd
                  className={
                    value
                      ? "text-sm break-words text-foreground"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {value ?? "Not discussed yet"}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
