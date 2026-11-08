import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/modules/training and supabase/migrations/20260825004004_milestone7_training_domain.sql";

const trainingFields: PlatformKnowledgeField[] = [
  {
    name: "Course name",
    identifier: "course_name",
    purpose: "Names the learning activity in the catalogue.",
    required: "required",
    constraints: "1 to 160 characters.",
    example: "Allergen awareness",
    mistakes: "Using a session date as the course name.",
    dependencies: "Courses have versions with delivery method and duration.",
    permissions: `${TRAINING_PERMISSIONS.catalogManage} to author. ${TRAINING_PERMISSIONS.read} to view.`,
    lifecycle: "Course status active or deactivated; versions are draft → published → archived.",
    consequences: "Deactivated courses cannot be assigned on new requirements.",
    setupSteps: "Training catalogue → create course → add draft version → publish version.",
  },
  {
    name: "Course code",
    identifier: "course_code",
    purpose: "Stable short code for imports and curriculum links.",
    required: "required",
    constraints: "Lowercase alphanumeric with . _ - ; 1 to 80 characters.",
    example: "allergen.awareness",
    mistakes: "Changing codes after completions exist without a migration plan.",
    dependencies: "Unique per organisation.",
    permissions: TRAINING_PERMISSIONS.catalogManage,
    lifecycle: "Set at course creation.",
    consequences: "Matrix and compliance views key off course and version.",
    setupSteps: "Choose a durable code before publishing the first version.",
  },
  {
    name: "Curriculum requirement job function",
    identifier: "job_function_id",
    purpose: "Says which role must complete the course when not applying to all members.",
    required: "required",
    constraints: "Required unless applies_to_all_members is true.",
    example: "Line Operator",
    mistakes: "Expecting training completion to prove Skills competence automatically.",
    dependencies: "Published curriculum version and published course version.",
    permissions: TRAINING_PERMISSIONS.curriculumManage,
    lifecycle: "Requirement valid on published curriculum version.",
    consequences: "Matrix shows required, completed, expiring, or expired.",
    setupSteps: "Curriculum → add requirement → pick job function or all members → course.",
  },
  {
    name: "Mandatory requirement",
    identifier: "mandatory",
    purpose: "Marks whether the course is required versus optional development.",
    required: "required",
    constraints: "Boolean on each requirement row.",
    example: "true for induction courses",
    mistakes: "Marking optional courses mandatory without manager agreement.",
    dependencies: "Works with required_within_days when set.",
    permissions: TRAINING_PERMISSIONS.curriculumManage,
    lifecycle: "Changes need a new curriculum draft if the version was published.",
    consequences: "Drives compliance colouring on the training matrix.",
    setupSteps: "Set mandatory when adding the requirement row.",
  },
  {
    name: "Session status",
    identifier: "session_status",
    purpose: "Tracks scheduled delivery of a course to participants.",
    required: "required",
    constraints: "scheduled | in_progress | completed | cancelled",
    example: "scheduled",
    mistakes: "Recording completions without a session when your process requires attendance.",
    dependencies: `${TRAINING_PERMISSIONS.sessionsManage} and ${TRAINING_PERMISSIONS.completionsManage}.`,
    permissions: TRAINING_PERMISSIONS.sessionsManage,
    lifecycle: "Scheduled sessions move through in_progress to completed or cancelled.",
    consequences: "Completions may reference session and completion_method.",
    setupSteps: "Sessions → schedule → take attendance → record completions.",
  },
];

export const TRAINING_AUDITED_FIELD_IDENTIFIERS = [
  "course_name",
  "course_code",
  "job_function_id",
  "mandatory",
  "session_status",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "training",
    workflow,
    sourcePath: SOURCE,
  });

export const TRAINING_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "training.overview",
    module: "training",
    title: "Training overview",
    workflows: ["training_catalogue", "training_curriculum", "training_setup"],
    routePrefixes: ["/platform/training"],
    purpose:
      "Deliver and track learning against published courses and curriculum requirements.",
    intendedUsers: "L&D administrators, managers, and members completing training.",
    facts: [
      "Readiness needs a published course version and a published curriculum with requirements.",
      "Setup supports manual, LEH Quick Start, and Build with LeanAI at /platform/training/setup.",
      "Training completion is not the same as Skills competence.",
      "Course–skill links describe relationships; assessment still records proficiency separately.",
      "LeanAI proposals stay draft until a person publishes.",
    ],
    fields: trainingFields,
    provenance: provenance("training.overview", "training_setup"),
  },
];

export function trainingKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(TRAINING_AUDITED_FIELD_IDENTIFIERS, TRAINING_KNOWLEDGE_ARTICLES);
}

export function trainingKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, TRAINING_KNOWLEDGE_ARTICLES);
}

export function trainingKnowledgeField(fieldName: string) {
  return knowledgeField(TRAINING_KNOWLEDGE_ARTICLES, fieldName);
}
