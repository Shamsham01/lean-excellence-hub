"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";

import { recordLeanAiSemanticEventAction } from "@/app/(platform)/platform/leanai/context/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hardNavigate } from "@/lib/navigation/navigate";
import { cn } from "@/lib/utils";

import type {
  LeanAiCoachPresentation,
  LeanAiCoachSurface,
  LeanAiInterventionCandidate,
} from "@/modules/leanai-context/interventions/types";

function shownStorageKey(organisationId: string, interventionKey: string) {
  return `leanai-coach-shown:${organisationId}:${interventionKey}`;
}

export function LeanAiCoachCard({
  recommendation,
  presentation = "card",
  surface,
}: {
  recommendation: LeanAiInterventionCandidate;
  presentation?: LeanAiCoachPresentation;
  surface?: LeanAiCoachSurface;
}) {
  const explainId = useId();
  const [explainOpen, setExplainOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const storageKey = shownStorageKey(
      recommendation.organisationId,
      recommendation.key,
    );
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        return;
      }
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage may be unavailable; still record the bounded event.
    }

    void recordLeanAiSemanticEventAction({
      eventKey: "leanai.intervention_shown",
      interventionKey: recommendation.key,
      moduleKey: recommendation.moduleKey,
      metadata: { surface: surface ?? recommendation.moduleKey },
    });
  }, [
    recommendation.key,
    recommendation.moduleKey,
    recommendation.organisationId,
    surface,
  ]);

  if (hidden) {
    return null;
  }

  const recordAndHide = (
    eventKey: "leanai.intervention_dismissed" | "leanai.intervention_snoozed",
    metadata: Record<string, string | number | boolean | null> = {},
  ) => {
    startTransition(async () => {
      setError(null);
      const result = await recordLeanAiSemanticEventAction({
        eventKey,
        interventionKey: recommendation.key,
        moduleKey: recommendation.moduleKey,
        metadata,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHidden(true);
    });
  };

  const accept = () => {
    startTransition(async () => {
      setError(null);
      const result = await recordLeanAiSemanticEventAction({
        eventKey: "leanai.intervention_accepted",
        interventionKey: recommendation.key,
        moduleKey: recommendation.moduleKey,
        metadata: {},
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      hardNavigate(recommendation.targetRoute);
    });
  };

  return (
    <Card
      role="region"
      aria-label="LeanAI Coach"
      className={cn(
        "border-primary/25 bg-accent/40 shadow-xs",
        presentation === "empty_state" && "bg-accent/50",
        presentation === "compact" && "bg-accent/30",
      )}
      data-testid="leanai-coach"
      data-intervention-key={recommendation.key}
    >
      <CardContent
        className={cn(
          "flex flex-col gap-4 p-4 sm:p-5",
          presentation === "empty_state" && "p-5 sm:p-6",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              LeanAI Coach
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">
              {recommendation.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {recommendation.body}
            </p>
          </div>
        </div>

        {explainOpen ? (
          <div
            id={explainId}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground"
            data-testid="leanai-coach-explain"
          >
            {recommendation.explain}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            size="sm"
            onClick={accept}
            disabled={pending}
            data-testid="leanai-coach-setup"
          >
            {recommendation.primaryCtaLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={explainOpen}
            aria-controls={explainId}
            onClick={() => setExplainOpen((open) => !open)}
            data-testid="leanai-coach-explain-toggle"
          >
            {explainOpen ? "Hide explanation" : "Explain"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => recordAndHide("leanai.intervention_dismissed")}
            data-testid="leanai-coach-later"
          >
            Later
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              recordAndHide("leanai.intervention_snoozed", {
                snooze_minutes: recommendation.snoozeMinutes,
              })
            }
            data-testid="leanai-coach-snooze"
          >
            Snooze
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
