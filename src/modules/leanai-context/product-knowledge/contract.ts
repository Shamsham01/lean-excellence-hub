import { LEH_PRODUCT_KNOWLEDGE_VERSION } from "./version";

export const PLATFORM_KNOWLEDGE_MODULE_KEYS = [
  "skills",
  "problem_solving",
  "maturity",
  "suggestions",
  "actions",
  "people",
  "five_s",
  "gemba",
  "training",
  "recognition",
  "projects",
  "benefits",
  "billing_administration",
] as const;

export type PlatformKnowledgeModuleKey =
  (typeof PLATFORM_KNOWLEDGE_MODULE_KEYS)[number];

export type KnowledgeProvenance = {
  knowledgeId: string;
  module: PlatformKnowledgeModuleKey;
  workflow: string;
  fieldIdentifier: string | null;
  sourcePath: string;
  sourceRevision: string;
  releaseKnowledgeVersion: string;
  lastValidation: string;
  coverageStatus: "audited" | "partial";
};

export type PlatformKnowledgeField = {
  name: string;
  identifier: string;
  purpose: string;
  required: "required" | "optional";
  constraints: string;
  example: string;
  mistakes: string;
  dependencies: string;
  permissions: string;
  lifecycle: string;
  consequences: string;
  setupSteps: string;
};

export type PlatformKnowledgeArticle = {
  id: string;
  module: PlatformKnowledgeModuleKey;
  title: string;
  workflows: readonly string[];
  routePrefixes: readonly string[];
  purpose: string;
  intendedUsers: string;
  facts: readonly string[];
  fields: readonly PlatformKnowledgeField[];
  provenance: KnowledgeProvenance;
};

export function platformKnowledgeProvenance(input: {
  knowledgeId: string;
  module: PlatformKnowledgeModuleKey;
  workflow: string;
  sourcePath: string;
  fieldIdentifier?: string | null;
  coverageStatus?: KnowledgeProvenance["coverageStatus"];
}): KnowledgeProvenance {
  return {
    knowledgeId: input.knowledgeId,
    module: input.module,
    workflow: input.workflow,
    fieldIdentifier: input.fieldIdentifier ?? null,
    sourcePath: input.sourcePath,
    sourceRevision: LEH_PRODUCT_KNOWLEDGE_VERSION,
    releaseKnowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
    lastValidation: LEH_PRODUCT_KNOWLEDGE_VERSION,
    coverageStatus: input.coverageStatus ?? "audited",
  };
}

export function knowledgeFieldGaps(
  auditedIdentifiers: readonly string[],
  articles: readonly PlatformKnowledgeArticle[],
): string[] {
  const present = new Set(
    articles.flatMap((article) =>
      article.fields.map((field) => field.identifier),
    ),
  );
  return auditedIdentifiers.filter((identifier) => !present.has(identifier));
}

export function knowledgeForPath(
  pathname: string,
  articles: readonly PlatformKnowledgeArticle[],
): PlatformKnowledgeArticle[] {
  const normalised = pathname.replace(/\/$/, "") || "/";
  const matched = articles.filter((article) =>
    article.routePrefixes.some(
      (prefix) =>
        normalised === prefix.replace(/\/$/, "") ||
        normalised.startsWith(`${prefix.replace(/\/$/, "")}/`),
    ),
  );
  if (matched.length > 0) {
    return matched;
  }
  const overview = articles.find((article) => article.id.endsWith(".overview"));
  return overview ? [overview] : articles.slice(0, 1);
}

export function knowledgeField(
  articles: readonly PlatformKnowledgeArticle[],
  fieldName: string,
): PlatformKnowledgeField | null {
  const focus = fieldName.trim().toLowerCase();
  for (const article of articles) {
    const hit = article.fields.find(
      (field) => field.name.toLowerCase() === focus,
    );
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function moduleFromPathname(
  pathname: string,
): PlatformKnowledgeModuleKey | null {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path.startsWith("/platform/skills")) return "skills";
  if (path.startsWith("/platform/problem-solving")) return "problem_solving";
  if (path.startsWith("/platform/maturity")) return "maturity";
  if (path.startsWith("/platform/suggestions")) return "suggestions";
  if (path.startsWith("/platform/actions")) return "actions";
  if (path.startsWith("/platform/people")) return "people";
  if (path.startsWith("/platform/5s")) return "five_s";
  if (path.startsWith("/platform/gemba")) return "gemba";
  if (path.startsWith("/platform/training")) return "training";
  if (path.startsWith("/platform/recognition")) return "recognition";
  if (path.startsWith("/platform/projects")) return "projects";
  if (path.startsWith("/platform/benefits")) return "benefits";
  if (
    path.startsWith("/platform/settings/billing") ||
    path.startsWith("/platform/settings/organisation")
  ) {
    return "billing_administration";
  }
  return null;
}
