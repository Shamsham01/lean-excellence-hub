"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  beginSuggestionReview,
  recordSuggestionReview,
} from "@/app/(platform)/platform/suggestions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { suggestionStatusLabel } from "@/lib/suggestions/status";

type ReviewWorkspaceProps = {
  suggestion: {
    id: string;
    title: string;
    status: string;
    problem_or_opportunity?: string | null;
    proposed_idea?: string | null;
    category_name?: string | null;
    origin_unit_name?: string | null;
  };
};

const LEVELS = ["low", "medium", "high"] as const;
const DECISIONS = [
  { value: "accept", label: "Accept" },
  { value: "reject", label: "Reject" },
  { value: "needs_more_information", label: "Needs more information" },
] as const;

function actionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return "Review could not be recorded";
}

export function ReviewWorkspace({ suggestion }: ReviewWorkspaceProps) {
  const router = useRouter();
  const [impact, setImpact] = useState<(typeof LEVELS)[number]>("medium");
  const [effort, setEffort] = useState<(typeof LEVELS)[number]>("medium");
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]["value"]>("accept");
  const [rationale, setRationale] = useState("");
  const [implementationRecommendation, setImplementationRecommendation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!rationale.trim()) {
      setError("Rationale is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (suggestion.status === "submitted") {
        const beginResult = await beginSuggestionReview(suggestion.id);
        if (beginResult.error) throw new Error(beginResult.error);
      }
      const reviewResult = await recordSuggestionReview(
        suggestion.id,
        decision,
        impact,
        effort,
        rationale.trim(),
        implementationRecommendation.trim() || undefined,
      );
      if (reviewResult.error) throw new Error(reviewResult.error);
      router.push(`/platform/suggestions/${suggestion.id}`);
      router.refresh();
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-testid="suggestion-review-workspace">
      <CardHeader>
        <CardTitle className="text-base">{suggestion.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {suggestionStatusLabel(suggestion.status)}
          {suggestion.category_name ? ` · ${suggestion.category_name}` : ""}
          {suggestion.origin_unit_name ? ` · ${suggestion.origin_unit_name}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm">
        {suggestion.problem_or_opportunity ? (
          <div>
            <p className="font-medium">What was noticed</p>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              {suggestion.problem_or_opportunity}
            </p>
          </div>
        ) : null}
        {suggestion.proposed_idea ? (
          <div>
            <p className="font-medium">Proposed change</p>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              {suggestion.proposed_idea}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-border pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <Label htmlFor="review-impact">Impact</Label>
              <select
                id="review-impact"
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                value={impact}
                onChange={(event) => setImpact(event.target.value as (typeof LEVELS)[number])}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <Label htmlFor="review-effort">Effort</Label>
              <select
                id="review-effort"
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                value={effort}
                onChange={(event) => setEffort(event.target.value as (typeof LEVELS)[number])}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Decision</legend>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((option) => (
                <label
                  key={option.value}
                  className={`min-h-11 cursor-pointer rounded-md border px-3 py-2 text-sm ${
                    decision === option.value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={option.value}
                    checked={decision === option.value}
                    onChange={() => setDecision(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <Label htmlFor="review-rationale">Rationale</Label>
            <Textarea
              id="review-rationale"
              required
              rows={3}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <Label htmlFor="review-implementation">Implementation recommendation</Label>
            <Textarea
              id="review-implementation"
              rows={2}
              value={implementationRecommendation}
              onChange={(event) => setImplementationRecommendation(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={loading} className="min-h-11 w-full sm:w-auto">
            {loading ? "Recording review…" : "Record review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
