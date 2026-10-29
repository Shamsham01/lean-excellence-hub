import { LEH_PRODUCT_KNOWLEDGE_VERSION } from "./version";

export type SkillsKnowledgeField = {
  name: string;
  purpose: string;
  required: "required" | "optional";
  constraints: string;
  example: string;
  mistakes: string;
  dependencies: string;
  permissions: string;
  consequences: string;
};

export type SkillsKnowledgeArticle = {
  id: string;
  title: string;
  workflows: readonly string[];
  routePrefixes: readonly string[];
  purpose: string;
  facts: readonly string[];
  fields: readonly SkillsKnowledgeField[];
  provenance: string;
};

const VERSION_NOTE = `Product knowledge ${LEH_PRODUCT_KNOWLEDGE_VERSION}, shipped with this release.`;

const sharedFacts = [
  "A job function is the role someone performs, such as Line Operator or Area Leader.",
  "A skill is an observable ability, such as Operate and monitor the oven.",
  "A proficiency scale describes how capability is judged. It is not a job grade.",
  "A requirement says which job function needs which skill, at what level, and where.",
  "An assessment is evidence of one person's demonstrated ability. Not assessed is not a low score.",
  "Training is a learning activity. Completing training does not automatically make someone competent.",
  "Example: Oven Operators at Bodmin must demonstrate Operate and monitor the oven at Competent.",
  "The skills catalogue and proficiency scale belong to the organisation. A selected site does not limit them.",
  "A requirement applies only to the organisational units confirmed on that requirement. Leave the unit unset to apply it wherever that job function is used.",
  "LeanAI can explain and propose. It cannot publish, assess people, grant permissions, or choose applicability.",
  "Quick Start sample content is a starting point. Food-production content is not a certification or a compliance guarantee.",
] as const;

const scaleFields: SkillsKnowledgeField[] = [
  {
    name: "Scale name",
    purpose: "Names how this organisation describes proficiency.",
    required: "required",
    constraints:
      "1 to 160 characters. A matching published scale with the same levels can be reused. A same-named scale with different levels is not overwritten.",
    example: "Sample manufacturing proficiency",
    mistakes: "Naming the scale after a site, or using job titles as levels.",
    dependencies: "Levels belong to a version of this scale.",
    permissions:
      "skills.catalog.manage to create or publish. skills.read to view.",
    consequences:
      "A published version is read-only. Publishing a later version of the same scale archives the previous published version. Existing assessments stay on the version they used.",
  },
  {
    name: "Level label",
    purpose:
      "The name of one step on the scale, from less capable to more capable.",
    required: "required",
    constraints:
      "At least two levels. Each order and label is unique. 1 to 120 characters.",
    example:
      "Competent — can perform the skill independently to the current standard.",
    mistakes: "Using job titles such as Supervisor as levels.",
    dependencies:
      "Requirements and assessments point at a level on a published version.",
    permissions: "skills.catalog.manage while the version is a draft.",
    consequences:
      "A published scale version cannot be edited in place. Create a successor version instead. History is kept.",
  },
];

const skillFields: SkillsKnowledgeField[] = [
  {
    name: "Skill name",
    purpose: "Names an observable ability.",
    required: "required",
    constraints:
      "1 to 160 characters. Close matches to an existing job-function title produce a warning and are not blocked.",
    example: "Operate and monitor the oven",
    mistakes:
      "Entering Line Operator, Area Leader, or Department Manager. Those are job functions.",
    dependencies:
      "Requirements and assessments refer to the skill. Draft skills from a setup bundle are not assessable.",
    permissions: "skills.catalog.manage to create. skills.read to view.",
    consequences:
      "A skill created by a setup draft stays draft until that bundle is published. Publishing does not create assessments.",
  },
  {
    name: "Evidence expectations",
    purpose: "Says what a good demonstration looks like.",
    required: "optional",
    constraints: "Up to 2,000 characters.",
    example:
      "Observed oven start-up and in-process checks. A training certificate is not enough.",
    mistakes: "Writing that course completion equals competence.",
    dependencies: "Shown to authors and assessors. It does not score anyone.",
    permissions: "skills.catalog.manage.",
    consequences:
      "Changing the wording later does not rewrite assessment history.",
  },
];

const requirementFields: SkillsKnowledgeField[] = [
  {
    name: "Job function",
    purpose: "The role that needs the skill.",
    required: "required",
    constraints:
      "Must be an active job function in this organisation. Setup does not create job functions or assign people to them.",
    example: "Oven Operator",
    mistakes:
      "Typing the job title into the skill name instead of selecting the job function here.",
    dependencies:
      "Uses job functions from People. The matrix matches a person's primary job function.",
    permissions:
      "skills.requirements.manage, plus skills.catalog.manage for a setup bundle.",
    consequences:
      "Publishing the standard makes the requirement operational for gap reporting. It does not assess anyone.",
  },
  {
    name: "Target proficiency",
    purpose: "The level the job function is expected to demonstrate.",
    required: "required",
    constraints:
      "Must be a level on the scale version used by the requirement.",
    example: "Competent",
    mistakes:
      "Treating the target as the person's current score, or as a pass mark from a course.",
    dependencies:
      "The scale version must be published before the standard can be published.",
    permissions: "skills.requirements.manage.",
    consequences:
      "People below the target, once assessed, show as below requirement. People with no validated assessment show as not assessed.",
  },
  {
    name: "Organisational unit",
    purpose: "Limits where this requirement applies.",
    required: "optional",
    constraints:
      "An active unit in this organisation, or unset. Unset means wherever that job function is used. It does not make the catalogue site-specific.",
    example: "Bodmin, for Oven Operators at that site only.",
    mistakes:
      "Assuming the site selected in the header limits every skill in the catalogue.",
    dependencies: "Units come from organisation structure.",
    permissions: "skills.requirements.manage.",
    consequences:
      "A requirement with a unit applies there. Other sites are unaffected by that row.",
  },
];

export const SKILLS_KNOWLEDGE_ARTICLES: readonly SkillsKnowledgeArticle[] = [
  {
    id: "skills.overview",
    title: "Skills overview and setup",
    workflows: [
      "skills",
      "skills_setup",
      "skills_quick_start",
      "skills_builder",
    ],
    routePrefixes: [
      "/platform/skills",
      "/platform/skills/setup",
      "/platform/skills/setup/quick-start",
      "/platform/skills/setup/leanai",
    ],
    purpose:
      "Help a first-time customer tell job functions, skills, scales, requirements, assessments, and training apart, and choose Manual, Quick Start, or LeanAI.",
    facts: [
      ...sharedFacts,
      "Setup order is scale, skills, role requirements, preview, then an explicit publish.",
      "Manual setup, Quick Start, and LeanAI all create a draft bundle. Nothing operational is published until a person publishes it.",
      "Quick Start works when LeanAI is off, out of quota, or unavailable.",
      "Discard setup draft removes only eligible draft-owned records with no external references. Reused records and assessment history stay.",
      "There is no application button that resets the organisation.",
    ],
    fields: [],
    provenance: `${VERSION_NOTE} Routes under /platform/skills/setup. Source: src/modules/skills and src/modules/leanai-context/product-knowledge/skills.ts.`,
  },
  {
    id: "skills.scale",
    title: "Proficiency scale",
    workflows: ["skills_scale"],
    routePrefixes: ["/platform/skills/scales"],
    purpose:
      "Explain how a proficiency scale is authored, published, and changed.",
    facts: [
      ...sharedFacts,
      "A published scale version is read-only. Publishing a later version of the same scale archives the previous published version.",
      "Assessments keep the level they were given. Archiving a scale version does not delete them.",
      "Advanced scale editing remains on the scale pages. Guided setup does not remove it.",
    ],
    fields: scaleFields,
    provenance: `${VERSION_NOTE} src/app/(platform)/platform/skills/scales and publish_skill_proficiency_scale_version.`,
  },
  {
    id: "skills.catalogue",
    title: "Skills catalogue",
    workflows: ["skills_catalogue"],
    routePrefixes: [
      "/platform/skills/catalog",
      "/platform/skills/setup/manual",
    ],
    purpose:
      "Explain catalogue fields and the difference between a skill and a job function.",
    facts: [
      ...sharedFacts,
      "Bulk entry accepts one skill per line. Duplicates of an existing skill are reused by a setup bundle and are not silently renamed.",
      "A warning appears when a proposed name matches a job function or reads like a bare job title. The name is still allowed.",
    ],
    fields: skillFields,
    provenance: `${VERSION_NOTE} src/components/skills and create_skill / setup bundle skill rows.`,
  },
  {
    id: "skills.requirements",
    title: "Capability standard and requirements",
    workflows: ["skills_requirements"],
    routePrefixes: [
      "/platform/skills/standards",
      "/platform/skills/setup/drafts",
    ],
    purpose: "Explain role requirements, target levels, and applicability.",
    facts: [
      ...sharedFacts,
      "Target proficiency is the level the job function is expected to demonstrate, not the person's current result.",
      "Publishing a setup bundle publishes its scale if that scale is still a draft, activates its draft skills, and publishes the capability standard.",
      "Publishing does not create people, job assignments, access grants, or assessments.",
      "If another published standard already exists, publishing this one makes it the latest standard used for the matrix. Earlier standards remain in history.",
    ],
    fields: requirementFields,
    provenance: `${VERSION_NOTE} skill_requirements and publish_skill_setup_bundle.`,
  },
  {
    id: "skills.matrix",
    title: "Skills matrix",
    workflows: ["skills_matrix"],
    routePrefixes: ["/platform/skills/matrix"],
    purpose:
      "Explain an empty matrix and the difference between not assessed and a low score.",
    facts: [
      ...sharedFacts,
      "The matrix stays empty of requirements until a capability standard is published and people have a primary job function that matches one.",
      "Not assessed means there is no current validated assessment. It is not a score of zero or the lowest level.",
      "Below requirement means a validated assessment is lower than the target. Meets and above mean the validated level is at or beyond the target.",
      "The header site does not hide organisation-wide skills. It also does not apply a requirement to a site you did not confirm.",
    ],
    fields: [],
    provenance: `${VERSION_NOTE} derive_skill_gap and src/components/skills/skills-matrix.tsx.`,
  },
  {
    id: "skills.assessment",
    title: "Skill assessment",
    workflows: ["skills_assessment", "people"],
    routePrefixes: ["/platform/people"],
    purpose: "Explain what an assessment records and what it does not change.",
    facts: [
      ...sharedFacts,
      "A validated assessment is the evidence the matrix uses. A self-assessment is not treated as the authoritative result.",
      "Draft skills from an unpublished setup cannot be assessed.",
      "Installing a starter pack never marks an employee competent.",
      "Changing or replacing a scale keeps existing assessment rows. They still show the level that was recorded.",
      "To correct a setup without losing history, publish a successor or archive through the normal versioning path. Do not delete assessments.",
    ],
    fields: [
      {
        name: "Proficiency level",
        purpose: "The level demonstrated on this occasion.",
        required: "required",
        constraints: "A level on the scale version being assessed.",
        example: "Competent, after an observed oven start-up.",
        mistakes:
          "Recording Competent because a training course was completed.",
        dependencies: "skills.assess, an active skill, and a published scale.",
        permissions:
          "skills.assess for a validation. The person may record a self-assessment where that path is offered.",
        consequences:
          "A validation can become the current authoritative result. Previous assessments remain in history.",
      },
    ],
    provenance: `${VERSION_NOTE} record_skill_validation and membership_skill_assessments.`,
  },
];

export function skillsKnowledgeForPath(
  pathname: string,
): SkillsKnowledgeArticle[] {
  const path = pathname.split("?")[0] ?? pathname;
  const specific = SKILLS_KNOWLEDGE_ARTICLES.filter((article) =>
    article.routePrefixes.some(
      (prefix) =>
        path === prefix ||
        (prefix !== "/platform/skills" && path.startsWith(prefix)),
    ),
  );
  if (specific.length > 0) {
    return specific;
  }
  if (path === "/platform/skills" || path.startsWith("/platform/skills/")) {
    const overview = SKILLS_KNOWLEDGE_ARTICLES.find(
      (article) => article.id === "skills.overview",
    );
    return overview ? [overview] : [];
  }
  if (/^\/platform\/people\/[^/]+$/.test(path)) {
    const assessment = SKILLS_KNOWLEDGE_ARTICLES.find(
      (article) => article.id === "skills.assessment",
    );
    return assessment ? [assessment] : [];
  }
  return [];
}

export function skillsKnowledgeField(
  pathname: string,
  fieldName: string,
): SkillsKnowledgeField | null {
  const normalised = fieldName.trim().toLowerCase();
  for (const article of skillsKnowledgeForPath(pathname)) {
    const field = article.fields.find(
      (item) => item.name.toLowerCase() === normalised,
    );
    if (field) {
      return field;
    }
  }
  for (const article of SKILLS_KNOWLEDGE_ARTICLES) {
    const field = article.fields.find(
      (item) => item.name.toLowerCase() === normalised,
    );
    if (field) {
      return field;
    }
  }
  return null;
}
