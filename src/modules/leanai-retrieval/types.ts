export const OPERATIONAL_KNOWLEDGE_DOMAINS = [
  "problem_solving_case",
  "improvement_suggestion",
  "action",
  "gemba_walk",
  "five_s_audit",
  "maturity_assessment",
  "ci_project",
  "improvement_benefit",
  "skill",
  "training_course",
] as const;

export type OperationalKnowledgeDomain =
  (typeof OPERATIONAL_KNOWLEDGE_DOMAINS)[number];

export type OperationalKnowledgeRecord = {
  recordId: string;
  recordType: OperationalKnowledgeDomain;
  title: string;
  status: string;
  href: string;
  excerpt: string;
  applicability: string;
  contentTrust: "untrusted_record";
  detail: Record<string, unknown>;
};

export type OperationalRecordContext = {
  recordId: string;
  recordType: OperationalKnowledgeDomain;
  title: string;
  status: string;
  href: string;
  excerpt: string;
  contentTrust: "untrusted_record";
};
