"use client";

import { useState, type FormEvent } from "react";

import {
  findAuthorisedProblemSolvingHistory,
  linkAuthorisedProblemSolvingCase,
} from "@/app/(platform)/platform/problem-solving/related-history-actions";
import { Button } from "@/components/ui/button";
import { explainProblemSolvingQuestion } from "@/modules/leanai-context/product-knowledge/problem-solving-explain";
import type { AuthorisedProblemSolvingCase } from "@/modules/problem-solving/authorised-history";
import { historyRelevance } from "@/modules/problem-solving/authorised-history";
import type { ProblemSolvingConsultation } from "@/modules/problem-solving/consultation";

const GUIDANCE_QUESTIONS = [
  "How do I start a problem-solving case?",
  "What is the difference between containment and a countermeasure?",
  "Does this release include DMAIC?",
] as const;

type RelatedWorkPanelProps = {
  mode: "draft" | "case";
  queryText: string;
  caseId?: string;
};

export function RelatedWorkPanel({
  mode,
  queryText,
  caseId,
}: RelatedWorkPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<AuthorisedProblemSolvingCase[] | null>(
    null,
  );
  const [consultation, setConsultation] =
    useState<ProblemSolvingConsultation | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setLinkMessage(null);
    try {
      const result = await findAuthorisedProblemSolvingHistory({
        mode,
        query: queryText,
        ...(caseId ? { caseId } : {}),
      });
      setMatches(result.matches);
      setConsultation(result.consultation);
      if (result.error) setError(result.error);
    } catch {
      setError("Problem-solving history could not be searched.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  async function linkCase(relatedCaseId: string) {
    if (!caseId) return;
    setLinkingId(relatedCaseId);
    setLinkMessage(null);
    try {
      const result = await linkAuthorisedProblemSolvingCase({
        caseId,
        relatedCaseId,
      });
      setLinkMessage(
        result.error ??
          "Linked. You can open the case and review the source link.",
      );
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3" data-testid="related-work-panel">
      <form onSubmit={search}>
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="text-sm font-medium">Related closed cases</legend>
          <p className="text-sm text-muted-foreground" id="related-work-help">
            Search uses closed cases you can already open. It does not call a
            model, and a match does not stop you creating or continuing a case.
          </p>
          <Button
            type="submit"
            variant="outline"
            disabled={loading}
            aria-describedby="related-work-help"
            data-testid="find-related-work"
          >
            {loading ? "Searching…" : "Find related work"}
          </Button>
        </fieldset>
      </form>

      <div className="flex flex-col gap-2" aria-live="polite">
        {error ? (
          <p className="text-sm text-destructive" role="status">
            {error}
          </p>
        ) : null}
        {consultation ? (
          <div data-testid="related-work-consultation">
            <p className="text-sm font-medium">{consultation.summary}</p>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm">
              {consultation.points.map((point) => (
                <li key={point.text}>
                  {point.text}{" "}
                  {point.href ? (
                    <a className="underline" href={point.href}>
                      View related work
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {consultation.questions.length > 0 ? (
              <ol className="mt-2 list-decimal pl-5 text-sm text-muted-foreground">
                {consultation.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
        {matches && matches.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {matches.map((match) => (
              <li
                key={match.caseId}
                className="rounded-md border border-border p-3"
                data-testid="related-work-match"
              >
                <p className="text-sm font-medium">{match.title}</p>
                <p className="text-xs text-muted-foreground">
                  Problem-solving case · {match.status} ·{" "}
                  {match.closureOutcome.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm">{historyRelevance(match)}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <a
                    className="inline-flex min-h-11 items-center text-sm underline"
                    href={match.href}
                  >
                    View related work
                  </a>
                  {mode === "case" && caseId ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={linkingId === match.caseId}
                      onClick={() => linkCase(match.caseId)}
                    >
                      Contribute or link
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Save the draft first if you want to link this case.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {linkMessage ? (
          <p className="text-sm" role="status">
            {linkMessage}
          </p>
        ) : null}
        {matches ? (
          <p className="text-sm" data-testid="continue-with-new-record">
            Continue with {mode === "draft" ? "a new record" : "this case"}.
            Similarity does not block it.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Product guidance</p>
        <p className="text-xs text-muted-foreground">
          These answers come from the release knowledge bundle. They do not use
          a model.
        </p>
        <div className="flex flex-col gap-2">
          {GUIDANCE_QUESTIONS.map((question) => (
            <Button
              key={question}
              type="button"
              variant="ghost"
              className="h-auto min-h-11 justify-start text-left whitespace-normal"
              onClick={() =>
                setGuidance(
                  explainProblemSolvingQuestion({
                    question,
                    pathname: "/platform/problem-solving/new",
                  }).answer,
                )
              }
            >
              {question}
            </Button>
          ))}
        </div>
        {guidance ? (
          <p className="text-sm" data-testid="problem-solving-guidance">
            {guidance}
          </p>
        ) : null}
      </div>
    </section>
  );
}
