import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/projects/status";
import { PROJECTS_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/lib/projects and supabase/migrations/20260825005001_milestone8_ci_projects_domain.sql";

const projectFields: PlatformKnowledgeField[] = [
  {
    name: "Project title",
    identifier: "title",
    purpose: "Names the improvement project in portfolio views.",
    required: "required",
    constraints: "1 to 200 characters typical; see create wizard validation.",
    example: "Reduce film waste phase 1",
    mistakes: "Using a project to track a single task better suited to Actions.",
    dependencies: "May originate from an accepted suggestion via explicit RPC.",
    permissions: `${PROJECTS_PERMISSIONS.manage} to create and advance. ${PROJECTS_PERMISSIONS.read} to view.`,
    lifecycle: `Statuses: ${PROJECT_STATUSES.join(", ")}.`,
    consequences: "Charter fields unlock as the project progresses.",
    setupSteps: "Projects → Create → title, unit, priority → charter steps.",
  },
  {
    name: "Project priority",
    identifier: "priority",
    purpose: "Portfolio ordering signal.",
    required: "required",
    constraints: PROJECT_PRIORITIES.join(" | "),
    example: "high",
    mistakes: "Marking all projects critical.",
    dependencies: "Charter and methodology version when activated.",
    permissions: PROJECTS_PERMISSIONS.manage,
    lifecycle: "Editable in early statuses; constrained when completed.",
    consequences: "Does not auto-create benefits records.",
    setupSteps: "Set on create wizard.",
  },
  {
    name: "Charter problem statement",
    identifier: "problem_statement",
    purpose: "States the gap the project addresses.",
    required: "required",
    constraints: "Charter extension fields per milestone 8 migrations.",
    example: "Seal defect rate 3% above target since changeover.",
    mistakes: "Copying a verified root cause from an unrelated problem-solving case.",
    dependencies: "Linked suggestion or problem-solving record when created from them.",
    permissions: PROJECTS_PERMISSIONS.manage,
    lifecycle: "Charter refined while draft or submitted.",
    consequences: "Approved charter gates activation.",
    setupSteps: "Project workspace → Charter → problem statement.",
  },
];

export const PROJECTS_AUDITED_FIELD_IDENTIFIERS = [
  "title",
  "priority",
  "problem_statement",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "projects",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const PROJECTS_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "projects.overview",
    module: "projects",
    title: "Projects overview",
    workflows: ["projects_portfolio", "project_workspace"],
    routePrefixes: ["/platform/projects"],
    purpose: "Structured improvement projects with charter, phases, and methodology.",
    intendedUsers: "CI leaders and sponsors with projects permissions.",
    facts: [
      "Projects are distinct from universal Actions and from Problem Solving cases.",
      "Creating a project from a suggestion is a deliberate workflow, not automatic on accept.",
      "LeanAI does not approve charters or change project status.",
    ],
    fields: projectFields,
    provenance: provenance("projects.overview", "projects_portfolio"),
  },
];

export function projectsKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(PROJECTS_AUDITED_FIELD_IDENTIFIERS, PROJECTS_KNOWLEDGE_ARTICLES);
}

export function projectsKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, PROJECTS_KNOWLEDGE_ARTICLES);
}

export function projectsKnowledgeField(fieldName: string) {
  return knowledgeField(PROJECTS_KNOWLEDGE_ARTICLES, fieldName);
}
