import { z } from "zod";

import { MATURITY_FRAMEWORK_SCOPE_TYPES } from "@/modules/maturity/semantic-scope";
import type { MaturityQuickStartDefinition } from "@/modules/maturity/templates/types";

import {
  MATURITY_BUILDER_DECLARED_KEY,
  MATURITY_BUILDER_LIMITS as LIMITS,
  type MaturityBuilderDiscoveryQuestion,
  type MaturityBuilderFocus,
  type MaturityBuilderProposal,
  type MaturityBuilderProposalCounts,
  type MaturityBuilderUnderstanding,
} from "./types";

const UNDERSTANDING_FIELD_MAX = 400;
const QUESTION_MAX = 240;
const SUGGESTED_ANSWER_MAX = 80;
const MAX_DISCOVERY_QUESTIONS = 3;
const MAX_SUGGESTED_ANSWERS = 4;
const CHANGE_SUMMARY_MAX = 6;
const CHANGE_SUMMARY_ITEM_MAX = 200;
export const MATURITY_BUILDER_MESSAGE_MAX = 2000;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = collapseWhitespace(value);
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Strict shape of the model envelope. Lengths and counts are enforced in
 * `validateMaturityBuilderProposal` so failures surface as readable issues.
 */
const rawQuestionSchema = z.object({ prompt: z.string() });

const rawCriterionSchema = z.object({
  name: z.string(),
  description: z.string(),
  guidance: z.string().nullable(),
  questions: z.array(rawQuestionSchema),
});

const rawPillarSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  guidance: z.string().nullable(),
  criteria: z.array(rawCriterionSchema),
});

const rawLevelSchema = z.object({
  name: z.string(),
  description: z.string(),
  guidance: z.string().nullable(),
});

export const rawMaturityBuilderProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  assessment_scopes: z.array(z.string()),
  levels: z.array(rawLevelSchema),
  pillars: z.array(rawPillarSchema),
});

export type RawMaturityBuilderProposal = z.infer<
  typeof rawMaturityBuilderProposalSchema
>;

const rawUnderstandingSchema = z.object({
  assessment_purpose: z.string().nullable(),
  assessment_scope: z.string().nullable(),
  pillars: z.string().nullable(),
  level_philosophy: z.string().nullable(),
  existing_standards: z.string().nullable(),
  suggestion_areas: z.string().nullable(),
  existing_framework: z.string().nullable(),
});

export const rawMaturityBuilderEnvelopeSchema = z.object({
  message: z.string(),
  phase: z.enum(["discovery", "proposal"]),
  understanding: rawUnderstandingSchema,
  questions: z.array(
    z.object({
      question: z.string(),
      suggested_answers: z.array(z.string()),
    }),
  ),
  change_summary: z.array(z.string()),
  proposal: rawMaturityBuilderProposalSchema.nullable(),
});

export type RawMaturityBuilderEnvelope = z.infer<
  typeof rawMaturityBuilderEnvelopeSchema
>;

export type ParsedMaturityBuilderEnvelope = {
  message: string;
  phase: "discovery" | "proposal";
  understanding: MaturityBuilderUnderstanding;
  questions: MaturityBuilderDiscoveryQuestion[];
  changeSummary: string[];
  proposal:
    | { status: "none" }
    | { status: "valid"; proposal: MaturityBuilderProposal }
    | { status: "invalid"; issues: string[] };
};

export type MaturityBuilderEnvelopeParseResult =
  | { ok: true; envelope: ParsedMaturityBuilderEnvelope }
  | { ok: false; issues: string[] };

export function normaliseMaturityBuilderUnderstanding(
  value: z.infer<typeof rawUnderstandingSchema>,
): MaturityBuilderUnderstanding {
  return {
    assessmentPurpose: optionalText(
      value.assessment_purpose,
      UNDERSTANDING_FIELD_MAX,
    ),
    assessmentScope: optionalText(
      value.assessment_scope,
      UNDERSTANDING_FIELD_MAX,
    ),
    pillars: optionalText(value.pillars, UNDERSTANDING_FIELD_MAX),
    levelPhilosophy: optionalText(
      value.level_philosophy,
      UNDERSTANDING_FIELD_MAX,
    ),
    existingStandards: optionalText(
      value.existing_standards,
      UNDERSTANDING_FIELD_MAX,
    ),
    suggestionAreas: optionalText(
      value.suggestion_areas,
      UNDERSTANDING_FIELD_MAX,
    ),
    existingFramework: optionalText(
      value.existing_framework,
      UNDERSTANDING_FIELD_MAX,
    ),
  };
}

/**
 * Parse the model envelope. Envelope-level problems make the whole response
 * unusable; proposal-level problems keep the message but reject the proposal.
 */
export function parseMaturityBuilderEnvelope(
  value: unknown,
): MaturityBuilderEnvelopeParseResult {
  const parsed = rawMaturityBuilderEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues
        .slice(0, 5)
        .map(
          (issue) => `${issue.path.join(".") || "response"}: ${issue.message}`,
        ),
    };
  }
  const raw = parsed.data;
  const message = collapseMessage(raw.message);
  if (!message) {
    return { ok: false, issues: ["message: LeanAI returned an empty reply."] };
  }

  const questions = raw.questions
    .map((entry) => ({
      question: optionalText(entry.question, QUESTION_MAX) ?? "",
      suggestedAnswers: entry.suggested_answers
        .map((answer) => optionalText(answer, SUGGESTED_ANSWER_MAX))
        .filter((answer): answer is string => Boolean(answer))
        .slice(0, MAX_SUGGESTED_ANSWERS),
    }))
    .filter((entry) => entry.question.length > 0)
    .slice(0, MAX_DISCOVERY_QUESTIONS);

  const changeSummary = raw.change_summary
    .map((entry) => optionalText(entry, CHANGE_SUMMARY_ITEM_MAX))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, CHANGE_SUMMARY_MAX);

  let proposal: ParsedMaturityBuilderEnvelope["proposal"] = { status: "none" };
  if (raw.proposal) {
    const validated = validateMaturityBuilderProposal(raw.proposal);
    proposal = validated.ok
      ? { status: "valid", proposal: validated.proposal }
      : { status: "invalid", issues: validated.issues };
  }

  return {
    ok: true,
    envelope: {
      message,
      phase: raw.phase,
      understanding: normaliseMaturityBuilderUnderstanding(raw.understanding),
      questions,
      changeSummary,
      proposal,
    },
  };
}

function collapseMessage(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MATURITY_BUILDER_MESSAGE_MAX);
}

export type MaturityBuilderProposalValidation =
  | { ok: true; proposal: MaturityBuilderProposal }
  | { ok: false; issues: string[] };

type IssueCollector = {
  issues: string[];
  add(message: string): void;
};

function collector(): IssueCollector {
  const issues: string[] = [];
  return {
    issues,
    add(message: string) {
      if (issues.length < 12) {
        issues.push(message);
      }
    },
  };
}

function requiredText(
  value: unknown,
  max: number,
  label: string,
  issues: IssueCollector,
): string {
  const text = typeof value === "string" ? collapseWhitespace(value) : "";
  if (!text) {
    issues.add(`${label} is required.`);
    return "";
  }
  if (text.length > max) {
    issues.add(`${label} must be ${max} characters or fewer.`);
  }
  return text;
}

function nullableText(
  value: unknown,
  max: number,
  label: string,
  issues: IssueCollector,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    issues.add(`${label} must be text.`);
    return null;
  }
  const text = collapseWhitespace(value);
  if (!text) {
    return null;
  }
  if (text.length > max) {
    issues.add(`${label} must be ${max} characters or fewer.`);
  }
  return text;
}

function countIssue(
  count: number,
  min: number,
  max: number,
  label: string,
  issues: IssueCollector,
) {
  if (count < min || count > max) {
    issues.add(
      min === max
        ? `${label} must contain exactly ${min}.`
        : `${label} must contain between ${min} and ${max}.`,
    );
  }
}

function duplicateNames(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    const key = name.toLocaleLowerCase("en-GB");
    if (seen.has(key)) {
      duplicates.add(name);
    }
    seen.add(key);
  }
  return [...duplicates];
}

/**
 * Validate and normalise model output into a proposal the database bulk path
 * can store. Rejects instead of repairing structural problems: model output is
 * never authoritative and the user can retry or refine.
 */
export function validateMaturityBuilderProposal(
  value: unknown,
): MaturityBuilderProposalValidation {
  const parsed = rawMaturityBuilderProposalSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        "The proposal structure was incomplete. Ask LeanAI to regenerate it.",
      ],
    };
  }
  const raw = parsed.data;
  const issues = collector();

  const name = requiredText(
    raw.name,
    LIMITS.frameworkNameMax,
    "Framework name",
    issues,
  );
  const description = requiredText(
    raw.description,
    LIMITS.frameworkDescriptionMax,
    "Framework description",
    issues,
  );

  const allowedScopes = new Set<string>(MATURITY_FRAMEWORK_SCOPE_TYPES);
  const assessmentScopes = MATURITY_FRAMEWORK_SCOPE_TYPES.filter((scope) =>
    raw.assessment_scopes.some((candidate) => candidate.trim() === scope),
  );
  if (
    raw.assessment_scopes.some(
      (candidate) => !allowedScopes.has(candidate.trim()),
    )
  ) {
    issues.add("Assessment scope must be site, department or area.");
  }
  if (assessmentScopes.length === 0) {
    issues.add("Choose at least one assessment scope.");
  }

  countIssue(
    raw.levels.length,
    LIMITS.minLevels,
    LIMITS.maxLevels,
    "Maturity levels",
    issues,
  );
  const levels = raw.levels.map((level, index) => ({
    name: requiredText(
      level.name,
      LIMITS.levelNameMax,
      `Level ${index + 1} name`,
      issues,
    ),
    description: requiredText(
      level.description,
      LIMITS.textMax,
      `Level ${index + 1} description`,
      issues,
    ),
    guidance: nullableText(
      level.guidance,
      LIMITS.textMax,
      `Level ${index + 1} guidance`,
      issues,
    ),
  }));
  for (const duplicate of duplicateNames(levels.map((level) => level.name))) {
    issues.add(`Level name “${duplicate}” is used more than once.`);
  }

  countIssue(
    raw.pillars.length,
    LIMITS.minPillars,
    LIMITS.maxPillars,
    "Pillars",
    issues,
  );
  let criteriaTotal = 0;
  let questionsTotal = 0;
  const pillars = raw.pillars.map((pillar, pillarIndex) => {
    const pillarLabel = `Pillar ${pillarIndex + 1}`;
    const pillarName = requiredText(
      pillar.name,
      LIMITS.pillarNameMax,
      `${pillarLabel} name`,
      issues,
    );
    countIssue(
      pillar.criteria.length,
      LIMITS.minCriteriaPerPillar,
      LIMITS.maxCriteriaPerPillar,
      `${pillarLabel} criteria`,
      issues,
    );
    criteriaTotal += pillar.criteria.length;
    const criteria = pillar.criteria.map((criterion, criterionIndex) => {
      const criterionLabel = `${pillarLabel}, criterion ${criterionIndex + 1}`;
      countIssue(
        criterion.questions.length,
        LIMITS.minQuestionsPerCriterion,
        LIMITS.maxQuestionsPerCriterion,
        `${criterionLabel} questions`,
        issues,
      );
      questionsTotal += criterion.questions.length;
      return {
        name: requiredText(
          criterion.name,
          LIMITS.criterionNameMax,
          `${criterionLabel} name`,
          issues,
        ),
        description: requiredText(
          criterion.description,
          LIMITS.textMax,
          `${criterionLabel} description`,
          issues,
        ),
        guidance: nullableText(
          criterion.guidance,
          LIMITS.textMax,
          `${criterionLabel} guidance`,
          issues,
        ),
        questions: criterion.questions.map((question, questionIndex) => ({
          prompt: requiredText(
            question.prompt,
            LIMITS.questionPromptMax,
            `${criterionLabel}, question ${questionIndex + 1}`,
            issues,
          ),
        })),
      };
    });
    for (const duplicate of duplicateNames(
      criteria.map((criterion) => criterion.name),
    )) {
      issues.add(
        `${pillarLabel} uses criterion name “${duplicate}” more than once.`,
      );
    }
    return {
      name: pillarName,
      description: nullableText(
        pillar.description,
        LIMITS.textMax,
        `${pillarLabel} description`,
        issues,
      ),
      guidance: nullableText(
        pillar.guidance,
        LIMITS.textMax,
        `${pillarLabel} guidance`,
        issues,
      ),
      criteria,
    };
  });
  for (const duplicate of duplicateNames(
    pillars.map((pillar) => pillar.name),
  )) {
    issues.add(`Pillar name “${duplicate}” is used more than once.`);
  }
  if (criteriaTotal > LIMITS.maxCriteriaTotal) {
    issues.add(
      `The framework can include at most ${LIMITS.maxCriteriaTotal} criteria in one proposal.`,
    );
  }
  if (questionsTotal > LIMITS.maxQuestionsTotal) {
    issues.add(
      `The framework can include at most ${LIMITS.maxQuestionsTotal} scored questions in one proposal.`,
    );
  }

  if (issues.issues.length > 0) {
    return { ok: false, issues: issues.issues };
  }

  return {
    ok: true,
    proposal: {
      name,
      description,
      assessmentScopes: [...assessmentScopes],
      levels,
      pillars,
    },
  };
}

export function toRawMaturityBuilderProposal(
  proposal: MaturityBuilderProposal,
): RawMaturityBuilderProposal {
  return {
    name: proposal.name,
    description: proposal.description,
    assessment_scopes: [...proposal.assessmentScopes],
    levels: proposal.levels.map((level) => ({
      name: level.name,
      description: level.description,
      guidance: level.guidance,
    })),
    pillars: proposal.pillars.map((pillar) => ({
      name: pillar.name,
      description: pillar.description,
      guidance: pillar.guidance,
      criteria: pillar.criteria.map((criterion) => ({
        name: criterion.name,
        description: criterion.description,
        guidance: criterion.guidance,
        questions: criterion.questions.map((question) => ({
          prompt: question.prompt,
        })),
      })),
    })),
  };
}

/**
 * Re-validate a stored proposal before display or acceptance. Stored payloads
 * are written by the requesting member's own run and are still untrusted.
 */
export function revalidateStoredMaturityBuilderProposal(
  value: unknown,
): MaturityBuilderProposal | null {
  const stored = storedProposalSchema.safeParse(value);
  if (!stored.success) {
    return null;
  }
  const validated = validateMaturityBuilderProposal(
    toRawMaturityBuilderProposal(stored.data),
  );
  return validated.ok ? validated.proposal : null;
}

const storedProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  assessmentScopes: z.array(z.enum(MATURITY_FRAMEWORK_SCOPE_TYPES)),
  levels: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      guidance: z.string().nullable(),
    }),
  ),
  pillars: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      guidance: z.string().nullable(),
      criteria: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          guidance: z.string().nullable(),
          questions: z.array(z.object({ prompt: z.string() })),
        }),
      ),
    }),
  ),
});

export function maturityBuilderProposalCounts(
  proposal: MaturityBuilderProposal,
): MaturityBuilderProposalCounts {
  const criteria = proposal.pillars.reduce(
    (total, pillar) => total + pillar.criteria.length,
    0,
  );
  const questions = proposal.pillars.reduce(
    (total, pillar) =>
      total +
      pillar.criteria.reduce(
        (criterionTotal, criterion) =>
          criterionTotal + criterion.questions.length,
        0,
      ),
    0,
  );
  return {
    levels: proposal.levels.length,
    pillars: proposal.pillars.length,
    criteria,
    questions,
  };
}

/**
 * Convert an accepted proposal into the bulk definition consumed by
 * `create_maturity_model_draft_from_definition`. Level colour tokens are
 * derived here, never taken from model output.
 */
export function maturityBuilderProposalToDefinition(
  proposal: MaturityBuilderProposal,
): MaturityQuickStartDefinition {
  return {
    key: MATURITY_BUILDER_DECLARED_KEY,
    name: proposal.name,
    description: proposal.description,
    assessmentScopes: [...proposal.assessmentScopes],
    levels: proposal.levels.map((level, index) => ({
      name: level.name,
      colorToken: `maturity-${index + 1}`,
      description: level.description,
      guidance: level.guidance ?? "",
    })),
    pillars: proposal.pillars.map((pillar) => ({
      name: pillar.name,
      description: pillar.description,
      guidance: pillar.guidance,
      criteria: pillar.criteria.map((criterion) => ({
        name: criterion.name,
        description: criterion.description,
        guidance: criterion.guidance ?? "",
        questions: criterion.questions.map((question) => ({
          prompt: question.prompt,
          allowsNotApplicable: true,
        })),
      })),
    })),
  };
}

const focusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("framework") }),
  z.object({ kind: z.literal("levels") }),
  z.object({
    kind: z.literal("pillar"),
    pillarIndex: z
      .number()
      .int()
      .min(0)
      .max(LIMITS.maxPillars - 1),
  }),
  z.object({
    kind: z.literal("criterion"),
    pillarIndex: z
      .number()
      .int()
      .min(0)
      .max(LIMITS.maxPillars - 1),
    criterionIndex: z
      .number()
      .int()
      .min(0)
      .max(LIMITS.maxCriteriaPerPillar - 1),
  }),
]);

export function parseMaturityBuilderFocus(
  value: unknown,
): MaturityBuilderFocus | null {
  const parsed = focusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type ResolvedMaturityBuilderFocus = {
  focus: MaturityBuilderFocus;
  label: string;
};

/** Bind a browser-supplied focus to the server-derived current proposal. */
export function resolveMaturityBuilderFocus(
  value: unknown,
  proposal: MaturityBuilderProposal | null,
): ResolvedMaturityBuilderFocus | null {
  const focus = parseMaturityBuilderFocus(value);
  if (!focus || !proposal) {
    return null;
  }
  switch (focus.kind) {
    case "framework":
      return { focus, label: `the framework name and description` };
    case "levels":
      return { focus, label: "the maturity levels" };
    case "pillar": {
      const pillar = proposal.pillars[focus.pillarIndex];
      return pillar ? { focus, label: `pillar “${pillar.name}”` } : null;
    }
    case "criterion": {
      const criterion =
        proposal.pillars[focus.pillarIndex]?.criteria[focus.criterionIndex];
      return criterion
        ? { focus, label: `criterion “${criterion.name}”` }
        : null;
    }
    default: {
      const exhaustive: never = focus;
      return exhaustive;
    }
  }
}
