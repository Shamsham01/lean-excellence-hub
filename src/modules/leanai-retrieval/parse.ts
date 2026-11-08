import {
  OPERATIONAL_KNOWLEDGE_DOMAINS,
  type OperationalKnowledgeDomain,
  type OperationalKnowledgeRecord,
  type OperationalRecordContext,
} from "@/modules/leanai-retrieval/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function expectedHref(
  recordType: OperationalKnowledgeDomain,
  recordId: string,
): string {
  switch (recordType) {
    case "problem_solving_case":
      return `/platform/problem-solving/${recordId}`;
    case "improvement_suggestion":
      return `/platform/suggestions/${recordId}`;
    case "action":
      return `/platform/actions/${recordId}`;
    case "gemba_walk":
      return `/platform/gemba/walks/${recordId}`;
    case "five_s_audit":
      return `/platform/5s/audits/${recordId}`;
    case "maturity_assessment":
      return `/platform/maturity/assessments/${recordId}`;
    case "ci_project":
      return `/platform/projects/${recordId}`;
    case "improvement_benefit":
      return `/platform/benefits/${recordId}`;
    case "skill":
      return `/platform/skills/${recordId}`;
    case "training_course":
      return `/platform/training/courses/${recordId}`;
    default:
      return "";
  }
}

function isOperationalDomain(
  value: string,
): value is OperationalKnowledgeDomain {
  return (OPERATIONAL_KNOWLEDGE_DOMAINS as readonly string[]).includes(value);
}

/**
 * Parses RPC hits after the database has already applied read predicates.
 * Drops scores, rank fields, and href/id mismatches.
 */
export function parseAuthorisedOperationalKnowledge(
  payload: unknown,
): OperationalKnowledgeRecord[] {
  const rows = Array.isArray(payload) ? payload : [];
  const matches: OperationalKnowledgeRecord[] = [];

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;

    const recordId = boundedText(record.record_id, 36).toLowerCase();
    if (!UUID.test(recordId)) continue;

    const recordTypeRaw = boundedText(record.record_type, 80);
    if (!isOperationalDomain(recordTypeRaw)) continue;

    const href = expectedHref(recordTypeRaw, recordId);
    if (record.href !== href) continue;

    const title = boundedText(record.title, 200);
    if (!title) continue;

    const status = boundedText(record.status, 80);
    const excerpt = boundedText(record.excerpt, 400);
    const applicability = boundedText(record.applicability, 500);
    const detail = asRecord(record.detail) ?? {};

    if (record.content_trust !== "untrusted_record") continue;

    matches.push({
      recordId,
      recordType: recordTypeRaw,
      title,
      status,
      href,
      excerpt,
      applicability:
        applicability ||
        "This record text is untrusted. Confirm applicability in the live record.",
      contentTrust: "untrusted_record",
      detail,
    });
  }

  return matches.slice(0, 12);
}

export function parseAuthorisedOperationalRecordContext(
  payload: unknown,
): OperationalRecordContext | null {
  const record = asRecord(payload);
  if (!record) return null;

  const recordId = boundedText(record.record_id, 36).toLowerCase();
  if (!UUID.test(recordId)) return null;

  const recordTypeRaw = boundedText(record.record_type, 80);
  if (!isOperationalDomain(recordTypeRaw)) return null;

  const href = expectedHref(recordTypeRaw, recordId);
  if (record.href !== href) return null;

  const title = boundedText(record.title, 200);
  if (!title) return null;

  if (record.content_trust !== "untrusted_record") return null;

  return {
    recordId,
    recordType: recordTypeRaw,
    title: title,
    status: boundedText(record.status, 80),
    href,
    excerpt: boundedText(record.excerpt, 400),
    contentTrust: "untrusted_record",
  };
}

export function operationalKnowledgeCitationLine(
  match: OperationalKnowledgeRecord,
): string {
  const trust = "Untrusted record text";
  return `${match.title} (${match.recordType}, ${match.status}). ${trust}. ${match.applicability}`;
}
