import { skillsKnowledgeFieldGaps } from "./skills";
import { problemSolvingKnowledgeFieldGaps } from "./problem-solving";
import { maturityKnowledgeFieldGaps } from "./maturity";
import { suggestionsKnowledgeFieldGaps } from "./suggestions";
import { actionsKnowledgeFieldGaps } from "./actions";
import { trainingKnowledgeFieldGaps } from "./training";
import { peopleKnowledgeFieldGaps } from "./people";
import { fiveSKnowledgeFieldGaps } from "./five-s";
import { gembaKnowledgeFieldGaps } from "./gemba";
import { recognitionKnowledgeFieldGaps } from "./recognition";
import { projectsKnowledgeFieldGaps } from "./projects";
import { benefitsKnowledgeFieldGaps } from "./benefits";
import { billingAdminKnowledgeFieldGaps } from "./billing-admin";
import type { PlatformKnowledgeModuleKey } from "./contract";
import { MATURITY_KNOWLEDGE_ARTICLES } from "./maturity";
import { SUGGESTIONS_KNOWLEDGE_ARTICLES } from "./suggestions";
import { ACTIONS_KNOWLEDGE_ARTICLES } from "./actions";
import { TRAINING_KNOWLEDGE_ARTICLES } from "./training";
import { PEOPLE_KNOWLEDGE_ARTICLES } from "./people";
import { FIVE_S_KNOWLEDGE_ARTICLES } from "./five-s";
import { GEMBA_KNOWLEDGE_ARTICLES } from "./gemba";
import { RECOGNITION_KNOWLEDGE_ARTICLES } from "./recognition";
import { PROJECTS_KNOWLEDGE_ARTICLES } from "./projects";
import { BENEFITS_KNOWLEDGE_ARTICLES } from "./benefits";
import { BILLING_ADMIN_KNOWLEDGE_ARTICLES } from "./billing-admin";
import { SKILLS_KNOWLEDGE_ARTICLES } from "./skills";
import { PROBLEM_SOLVING_KNOWLEDGE_ARTICLES } from "./problem-solving";

export type PlatformKnowledgeModuleRegistryEntry = {
  module: PlatformKnowledgeModuleKey;
  fieldGaps: () => string[];
  articleCount: number;
  routePrefixes: readonly string[];
};

export const PLATFORM_KNOWLEDGE_MODULE_REGISTRY: readonly PlatformKnowledgeModuleRegistryEntry[] =
  [
    {
      module: "skills",
      fieldGaps: skillsKnowledgeFieldGaps,
      articleCount: SKILLS_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/skills"],
    },
    {
      module: "problem_solving",
      fieldGaps: problemSolvingKnowledgeFieldGaps,
      articleCount: PROBLEM_SOLVING_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/problem-solving"],
    },
    {
      module: "maturity",
      fieldGaps: maturityKnowledgeFieldGaps,
      articleCount: MATURITY_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/maturity"],
    },
    {
      module: "suggestions",
      fieldGaps: suggestionsKnowledgeFieldGaps,
      articleCount: SUGGESTIONS_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/suggestions"],
    },
    {
      module: "actions",
      fieldGaps: actionsKnowledgeFieldGaps,
      articleCount: ACTIONS_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/actions"],
    },
    {
      module: "training",
      fieldGaps: trainingKnowledgeFieldGaps,
      articleCount: TRAINING_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/training"],
    },
    {
      module: "people",
      fieldGaps: peopleKnowledgeFieldGaps,
      articleCount: PEOPLE_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/people"],
    },
    {
      module: "five_s",
      fieldGaps: fiveSKnowledgeFieldGaps,
      articleCount: FIVE_S_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/5s"],
    },
    {
      module: "gemba",
      fieldGaps: gembaKnowledgeFieldGaps,
      articleCount: GEMBA_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/gemba"],
    },
    {
      module: "recognition",
      fieldGaps: recognitionKnowledgeFieldGaps,
      articleCount: RECOGNITION_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/recognition"],
    },
    {
      module: "projects",
      fieldGaps: projectsKnowledgeFieldGaps,
      articleCount: PROJECTS_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/projects"],
    },
    {
      module: "benefits",
      fieldGaps: benefitsKnowledgeFieldGaps,
      articleCount: BENEFITS_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/benefits"],
    },
    {
      module: "billing_administration",
      fieldGaps: billingAdminKnowledgeFieldGaps,
      articleCount: BILLING_ADMIN_KNOWLEDGE_ARTICLES.length,
      routePrefixes: ["/platform/settings/billing"],
    },
  ];

export function allPlatformKnowledgeFieldGaps(): Record<
  PlatformKnowledgeModuleKey,
  string[]
> {
  return Object.fromEntries(
    PLATFORM_KNOWLEDGE_MODULE_REGISTRY.map((entry) => [
      entry.module,
      entry.fieldGaps(),
    ]),
  ) as Record<PlatformKnowledgeModuleKey, string[]>;
}
