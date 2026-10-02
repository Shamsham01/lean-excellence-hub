"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";

import { explainLeanAiCoachIntervention } from "@/app/(platform)/platform/leanai/coach/actions";
import { recordLeanAiSemanticEventAction } from "@/app/(platform)/platform/leanai/context/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hardNavigate } from "@/lib/navigation/navigate";
import { cn } from "@/lib/utils";
import type { CoachEnvelope } from "@/platform/ai/types";

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
  applicationAiAvailable = false,
}: {
  recommendation: LeanAiInterventionCandidate;
  presentation?: LeanAiCoachPresentation;
  surface?: LeanAiCoachSurface;
  applicationAiAvailable?: boolean;
}) {
  const explainId = useId();
  const followUpId = useId();
  const [explainOpen, setExplainOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAiTransition] = useTransition();
  const [explanationSource, setExplanationSource] = useState<
    "static" | "ai" | "loading"
  >("static");
  const [aiEnvelope, setAiEnvelope] = useState<CoachEnvelope | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");

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

  const requestExplanation = (followUpText?: string) => {
    if (!applicationAiAvailable) {
      setExplanationSource("static");
      setExplainOpen(true);
      return;
    }

    setExplainOpen(true);
    setExplanationSource("loading");
    setError(null);
    startAiTransition(async () => {
      const result = await explainLeanAiCoachIntervention({
        interventionKey: recommendation.key,
        surface: surface ?? "platform_home",
        sessionId,
        followUp: followUpText ?? null,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setExplanationSource(aiEnvelope ? "ai" : "static");
        if (
          result.reason !== "application_unavailable" &&
          result.reason !== "organisation_ai_disabled" &&
          result.reason !== "permission_denied"
        ) {
          setError(result.message);
        }
        return;
      }
      setAiEnvelope(result.envelope);
      setSessionId(result.sessionId);
      setExplanationSource("ai");
      setFollowUp("");
    });
  };

  const toggleExplain = () => {
    if (explainOpen) {
      setExplainOpen(false);
      return;
    }
    requestExplanation();
  };

  const shownEnvelope = explanationSource === "ai" ? aiEnvelope : null;

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
            <p className="text-xs font-medium tracking-wide whitespace-nowrap text-primary uppercase">
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
            data-explanation-source={explanationSource}
            aria-busy={explanationSource === "loading"}
          >
            {explanationSource === "loading" ? (
              <p data-testid="leanai-coach-explain-loading">Asking LeanAI…</p>
            ) : shownEnvelope ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  AI-generated guidance
                </p>
                <p data-testid="leanai-coach-explain-ai">
                  {shownEnvelope.message}
                </p>
                {shownEnvelope.permission_note ? (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="leanai-coach-permission-note"
                  >
                    {shownEnvelope.permission_note}
                  </p>
                ) : null}
                {shownEnvelope.suggested_next_step ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() =>
                      hardNavigate(shownEnvelope.suggested_next_step!.route)
                    }
                    data-testid="leanai-coach-ai-next-step"
                  >
                    {shownEnvelope.suggested_next_step.label}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Setup guidance
                </p>
                <p data-testid="leanai-coach-explain-static">
                  {recommendation.explain}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {explainOpen && shownEnvelope ? (
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              const value = followUp.trim();
              if (!value || aiPending) {
                return;
              }
              requestExplanation(value);
            }}
          >
            <label className="sr-only" htmlFor={followUpId}>
              Ask LeanAI a follow-up
            </label>
            <Input
              id={followUpId}
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              placeholder="Ask a follow-up"
              maxLength={2000}
              disabled={aiPending}
              data-testid="leanai-coach-follow-up"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={aiPending || followUp.trim().length === 0}
              data-testid="leanai-coach-follow-up-send"
            >
              Ask
            </Button>
          </form>
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
            onClick={toggleExplain}
            disabled={aiPending}
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
