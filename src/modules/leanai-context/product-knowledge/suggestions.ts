import { SUGGESTION_STATUSES } from "@/lib/suggestions/status";
import { SUGGESTIONS_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/lib/suggestions and supabase/migrations/20260825006001_milestone9_suggestion_programmes_domain.sql";

const submissionFields: PlatformKnowledgeField[] = [
  {
    name: "Programme version",
    identifier: "programme_version_id",
    purpose: "Chooses the published campaign people submit under.",
    required: "required",
    constraints: "Must be an active programme with a published version.",
    example: "Continuous Improvement 2026",
    mistakes: "Confusing programme with category, or submitting while only a draft programme exists.",
    dependencies: "Organisation maintains categories separately from programmes.",
    permissions: `${SUGGESTIONS_PERMISSIONS.submit} to submit. ${SUGGESTIONS_PERMISSIONS.programmesManage} to publish programmes.`,
    lifecycle: "Programme version lifecycle: draft → published → archived.",
    consequences: "Submit is blocked until a published programme version is active.",
    setupSteps: "Settings → Suggestion programmes → publish a version before opening submissions.",
  },
  {
    name: "Category",
    identifier: "category_id",
    purpose: "Classifies the kind of idea at organisation level.",
    required: "required",
    constraints: "Must be an active organisation category.",
    example: "Safety",
    mistakes: "Creating a category per programme instead of using the shared catalogue.",
    dependencies: "Categories are not children of programmes.",
    permissions: `${SUGGESTIONS_PERMISSIONS.programmesManage} to maintain categories.`,
    lifecycle: "Categories can be activated or deactivated in the catalogue.",
    consequences: "Inactive categories cannot be chosen on new submissions.",
    setupSteps: "Configure categories in Suggestions configuration alongside programmes.",
  },
  {
    name: "Suggestion title",
    identifier: "title",
    purpose: "Short name for the idea in queues and search.",
    required: "required",
    constraints: "1 to 200 characters, trimmed.",
    example: "Reduce film waste on Packing Line 1",
    mistakes: "Putting the whole solution in the title without describing the opportunity.",
    dependencies: "Requires programme version, category, and primary unit.",
    permissions: SUGGESTIONS_PERMISSIONS.submit,
    lifecycle: `Author may edit in draft. Status progresses: ${SUGGESTION_STATUSES.join(", ")}.`,
    consequences: "Title is visible to reviewers with suggestions.read in scope.",
    setupSteps: "New suggestion → pick programme → category → unit → title and narrative fields.",
  },
  {
    name: "Problem or opportunity",
    identifier: "problem_or_opportunity",
    purpose: "Describes what is wrong or what could improve.",
    required: "required",
    constraints: "1 to 4,000 characters.",
    example: "Film tension drifts after splice, causing seal defects.",
    mistakes: "Jumping to the fix without stating the observed gap.",
    dependencies: "Paired with proposed idea and optional benefit summary.",
    permissions: SUGGESTIONS_PERMISSIONS.submit,
    lifecycle: "Editable while draft; locked by workflow after submit depending on status.",
    consequences: "Feeds review and similarity search.",
    setupSteps: "Complete noticed/problem field before submit.",
  },
  {
    name: "Park rationale",
    identifier: "park_rationale",
    purpose: "Explains why a reviewer parked the suggestion.",
    required: "required",
    constraints: "1 to 4,000 characters when status is parked.",
    example: "Needs maintenance window confirmation before implementation.",
    mistakes: "Parking without a rationale the author can act on.",
    dependencies: "Only applies when status is parked.",
    permissions: SUGGESTIONS_PERMISSIONS.review,
    lifecycle: "Set during review; author may resubmit after changes.",
    consequences: "Parked suggestions are visible but not progressing.",
    setupSteps: "Review queue → Park → enter rationale.",
  },
];

export const SUGGESTIONS_AUDITED_FIELD_IDENTIFIERS = [
  "programme_version_id",
  "category_id",
  "title",
  "problem_or_opportunity",
  "park_rationale",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "suggestions",
    workflow,
    sourcePath: SOURCE,
  });

export const SUGGESTIONS_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "suggestions.overview",
    module: "suggestions",
    title: "Suggestions overview",
    workflows: ["programme_configuration", "suggestions_overview", "suggestion_submit"],
    routePrefixes: ["/platform/suggestions"],
    purpose:
      "Capture improvement ideas under published programmes using organisation-level categories.",
    intendedUsers: "Contributors, reviewers, and programme administrators.",
    facts: [
      "A programme is the campaign. A category is the type of idea. They are different catalogues.",
      "People cannot submit until an active programme has a published version.",
      "Reviewers may park with rationale, accept, reject, or progress to implementation.",
      "Linked actions and projects are created through explicit human actions, not by LeanAI.",
      `Statuses include parked: ${SUGGESTION_STATUSES.join(", ")}.`,
    ],
    fields: submissionFields,
    provenance: provenance("suggestions.overview", "programme_configuration"),
  },
];

export function suggestionsKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    SUGGESTIONS_AUDITED_FIELD_IDENTIFIERS,
    SUGGESTIONS_KNOWLEDGE_ARTICLES,
  );
}

export function suggestionsKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, SUGGESTIONS_KNOWLEDGE_ARTICLES);
}

export function suggestionsKnowledgeField(fieldName: string) {
  return knowledgeField(SUGGESTIONS_KNOWLEDGE_ARTICLES, fieldName);
}
