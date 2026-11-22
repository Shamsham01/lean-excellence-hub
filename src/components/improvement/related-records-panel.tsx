"use client";

import { useState } from "react";

import { findAuthorisedSimilarRecords } from "@/app/(platform)/platform/similarity/related-record-actions";
import { Button } from "@/components/ui/button";
import {
  similarityRelevance,
  type AuthorisedSimilarityMatch,
  type AuthorisedSimilarityRecordType,
} from "@/modules/improvement/authorised-similarity";

type RelatedRecordsPanelProps = {
  recordType: AuthorisedSimilarityRecordType;
  queryText: string;
  resolveQuery?: () => string;
  disabled?: boolean;
  /** Shorter help copy for compact surfaces (e.g. create dialog). */
  compactHelp?: boolean;
};

const ACTION_COMPACT_HELP =
  "Optional check for similar actions in your scope. You can still create this one.";

const COPY: Record<
  AuthorisedSimilarityRecordType,
  { legend: string; help: string; continueLabel: string; viewLabel: string }
> = {
  improvement_suggestion: {
    legend: "Related suggestions",
    help: "Search compares your words with suggestions you can already open. A longer description matches when at least three content words are shared. It does not call a model, and a match does not stop you submitting a new idea.",
    continueLabel: "Continue with a new suggestion",
    viewLabel: "View suggestion",
  },
  action: {
    legend: "Related actions",
    help: "Search compares your words with actions you can already open. A longer description matches when at least three content words are shared. It does not call a model, and a match does not stop you creating a new action.",
    continueLabel: "Continue with a new action",
    viewLabel: "View action",
  },
};

export function RelatedRecordsPanel({
  recordType,
  queryText,
  resolveQuery,
  disabled = false,
  compactHelp = false,
}: RelatedRecordsPanelProps) {
  const copy = COPY[recordType];
  const helpText =
    compactHelp && recordType === "action" ? ACTION_COMPACT_HELP : copy.help;

  function readQuery(): string {
    return (resolveQuery?.() ?? queryText).trim();
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<AuthorisedSimilarityMatch[] | null>(
    null,
  );

  async function runSearch() {
    const query = readQuery();
    if (!query) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await findAuthorisedSimilarRecords({
        recordType,
        query,
      });
      setMatches(result.matches);
      if (result.error) setError(result.error);
    } catch {
      setError(
        recordType === "improvement_suggestion"
          ? "Related suggestions could not be searched."
          : "Related actions could not be searched.",
      );
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="flex flex-col gap-3"
      data-testid={`related-${recordType === "improvement_suggestion" ? "suggestions" : "actions"}-panel`}
    >
      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="text-sm font-medium">{copy.legend}</legend>
        <p className="text-sm text-muted-foreground" id="related-records-help">
          {helpText}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void runSearch()}
          disabled={loading || disabled}
          aria-describedby="related-records-help"
          data-testid="find-related-records"
        >
          {loading ? "Searching…" : "Find related records"}
        </Button>
      </fieldset>

      <div className="flex flex-col gap-2" aria-live="polite">
        {error ? (
          <p className="text-sm text-destructive" role="status">
            {error}
          </p>
        ) : null}
        {matches && matches.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {matches.map((match) => (
              <li
                key={match.recordId}
                className="rounded-md border border-border p-3"
                data-testid="related-record-match"
              >
                <p className="text-sm font-medium">{match.title}</p>
                <p className="mt-1 text-sm">{similarityRelevance(match)}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <a
                    className="inline-flex min-h-11 items-center text-sm underline"
                    href={match.href}
                  >
                    {copy.viewLabel}
                  </a>
                  <p className="text-sm text-muted-foreground">
                    You can add a contribution from the open record after you
                    save, if your role allows it.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {matches ? (
          <p className="text-sm" data-testid="continue-with-new-record">
            {copy.continueLabel}. Similarity does not block it.
          </p>
        ) : null}
      </div>
    </section>
  );
}
