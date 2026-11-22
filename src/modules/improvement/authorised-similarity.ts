const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthorisedSimilarityRecordType =
  "improvement_suggestion" | "action";

export type AuthorisedSimilarityMatch = {
  recordId: string;
  recordType: AuthorisedSimilarityRecordType;
  title: string;
  status: string;
  href: string;
  excerpt: string;
  applicability: string;
  contentTrust: "untrusted_record";
};

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

function parseSuggestionRow(
  record: Record<string, unknown>,
): AuthorisedSimilarityMatch | null {
  const recordId = boundedText(record.suggestion_id, 36).toLowerCase();
  if (!UUID.test(recordId)) return null;
  if (record.record_type !== "improvement_suggestion") return null;
  const href = `/platform/suggestions/${recordId}`;
  if (record.href !== href) return null;
  const title = boundedText(record.title, 200);
  if (!title) return null;
  const status = boundedText(record.status, 80);
  if (!status || status === "draft" || status === "withdrawn") return null;
  return {
    recordId,
    recordType: "improvement_suggestion",
    title,
    status,
    href,
    excerpt: boundedText(record.body_excerpt, 240),
    applicability: boundedText(record.applicability, 400),
    contentTrust: "untrusted_record",
  };
}

function parseActionRow(
  record: Record<string, unknown>,
): AuthorisedSimilarityMatch | null {
  const recordId = boundedText(record.action_id, 36).toLowerCase();
  if (!UUID.test(recordId)) return null;
  if (record.record_type !== "action") return null;
  const href = `/platform/actions/${recordId}`;
  if (record.href !== href) return null;
  const title = boundedText(record.title, 200);
  if (!title) return null;
  const status = boundedText(record.status, 80);
  if (!status || status === "cancelled") return null;
  return {
    recordId,
    recordType: "action",
    title,
    status,
    href,
    excerpt: boundedText(record.description_excerpt, 240),
    applicability: boundedText(record.applicability, 400),
    contentTrust: "untrusted_record",
  };
}

/**
 * Drops scores, hidden counts, and rows whose href does not match the record id.
 */
export function parseAuthorisedSimilarityMatches(
  recordType: AuthorisedSimilarityRecordType,
  payload: unknown,
): AuthorisedSimilarityMatch[] {
  const rows = Array.isArray(payload) ? payload : [];
  const matches: AuthorisedSimilarityMatch[] = [];

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    if (record.content_trust !== "untrusted_record") continue;
    const parsed =
      recordType === "improvement_suggestion"
        ? parseSuggestionRow(record)
        : parseActionRow(record);
    if (parsed) matches.push(parsed);
  }

  return matches.slice(0, 8);
}

export function similarityRelevance(match: AuthorisedSimilarityMatch): string {
  const typeLabel =
    match.recordType === "improvement_suggestion" ? "Suggestion" : "Action";
  const excerpt = match.excerpt
    ? ` ${match.excerpt}`
    : " No excerpt is shown beyond the title.";
  return `${typeLabel} · ${match.status.replaceAll("_", " ")}.${excerpt} ${match.applicability || "Shared wording is a prompt to look, not evidence of a duplicate."}`;
}
