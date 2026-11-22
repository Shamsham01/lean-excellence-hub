const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AUTHORISED_HISTORY_EVIDENCE_CLASSES = [
  "historical_verified_outcome",
  "closed_without_verified_cause",
  "transferred",
] as const;

export type AuthorisedHistoryEvidenceClass =
  (typeof AUTHORISED_HISTORY_EVIDENCE_CLASSES)[number];

export type AuthorisedProblemSolvingCase = {
  caseId: string;
  recordType: "problem_solving_case";
  title: string;
  status: "closed";
  closureOutcome: string;
  href: string;
  problemStatementExcerpt: string;
  verifiedCauseSnippets: string[];
  evidenceClass: AuthorisedHistoryEvidenceClass;
  applicability: string;
  contentTrust: "untrusted_record";
};

const APPLICABILITY =
  "This is a finding on a closed case you can read. It does not prove the cause of another problem.";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * Keeps only closed cases the search function already authorised.
 * Drops scores, counts, and any href that does not point at the same case.
 */
export function parseAuthorisedProblemSolvingHistory(
  payload: unknown,
): AuthorisedProblemSolvingCase[] {
  const rows = Array.isArray(payload) ? payload : [];
  const matches: AuthorisedProblemSolvingCase[] = [];

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const caseId = boundedText(record.case_id, 36).toLowerCase();
    if (!UUID.test(caseId)) continue;
    if (record.status !== "closed") continue;
    if (record.record_type !== "problem_solving_case") continue;
    const href = `/platform/problem-solving/${caseId}`;
    if (record.href !== href) continue;
    const evidenceClass = record.evidence_class;
    if (
      typeof evidenceClass !== "string" ||
      !AUTHORISED_HISTORY_EVIDENCE_CLASSES.includes(
        evidenceClass as AuthorisedHistoryEvidenceClass,
      )
    ) {
      continue;
    }
    const title = boundedText(record.title, 200);
    if (!title) continue;
    const snippets = Array.isArray(record.verified_cause_snippets)
      ? record.verified_cause_snippets
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 240))
          .filter((item) => item.length > 0)
          .slice(0, 3)
      : [];

    matches.push({
      caseId,
      recordType: "problem_solving_case",
      title,
      status: "closed",
      closureOutcome: boundedText(record.closure_outcome, 80),
      href,
      problemStatementExcerpt: boundedText(
        record.problem_statement_excerpt,
        240,
      ),
      verifiedCauseSnippets: snippets,
      evidenceClass: evidenceClass as AuthorisedHistoryEvidenceClass,
      applicability: APPLICABILITY,
      contentTrust: "untrusted_record",
    });
  }

  return matches.slice(0, 8);
}

export function historyRelevance(match: AuthorisedProblemSolvingCase): string {
  if (match.evidenceClass === "historical_verified_outcome") {
    return "Closed with a verified cause on that case. The words overlap with this description. That does not show the same cause here.";
  }
  if (match.evidenceClass === "transferred") {
    return "Closed by transferring the work. There is no verified cause to copy from this case.";
  }
  return "Closed without a verified cause. Shared wording is a prompt to look, not evidence that the problems are the same.";
}
