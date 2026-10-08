import { z } from "zod";

import { boundedText } from "@/modules/module-setup/text";
import type { FiveSDraftDefinition } from "@/modules/5s/templates";

import {
  FIVE_S_BUILDER_DECLARED_KEY,
  FIVE_S_BUILDER_LIMITS as LIMITS,
  FIVE_S_QUESTION_TYPES,
  type FiveSBuilderProposal,
} from "./types";

const QUESTION_TYPES = new Set<string>(FIVE_S_QUESTION_TYPES);

const rawQuestionSchema = z.object({
  prompt: z.string(),
  question_type: z.string(),
  guidance: z.string().nullable(),
});

const rawCategorySchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  questions: z.array(rawQuestionSchema),
});

export const rawFiveSBuilderProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  threshold_percent: z.number(),
  categories: z.array(rawCategorySchema),
});

const understandingSchema = z.object({
  environment: z.string().nullable(),
  purpose: z.string().nullable(),
  audit_style: z.string().nullable(),
  depth: z.string().nullable(),
  evidence: z.string().nullable(),
  scoring: z.string().nullable(),
  terminology: z.string().nullable(),
});

export const rawFiveSBuilderEnvelopeSchema = z.object({
  message: z.string(),
  phase: z.enum(["discovery", "proposal"]),
  understanding: understandingSchema,
  questions: z.array(
    z.object({
      question: z.string(),
      suggested_answers: z.array(z.string()),
    }),
  ),
  change_summary: z.array(z.string()),
  proposal: rawFiveSBuilderProposalSchema.nullable(),
});

export type RawFiveSBuilderEnvelope = z.infer<
  typeof rawFiveSBuilderEnvelopeSchema
>;

export type ParsedFiveSBuilderEnvelope = {
  message: string;
  phase: "discovery" | "proposal";
  understanding: Record<string, string | null>;
  questions: Array<{ question: string; suggestedAnswers: string[] }>;
  changeSummary: string[];
  proposal: FiveSBuilderProposal | null;
  proposalStatus: "none" | "valid" | "invalid";
  proposalIssues: string[];
};

export function validateFiveSBuilderProposal(
  raw: z.infer<typeof rawFiveSBuilderProposalSchema>,
):
  | { ok: true; proposal: FiveSBuilderProposal }
  | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const name = boundedText(raw.name, LIMITS.nameMax, true);
  const description = boundedText(raw.description, LIMITS.descriptionMax, true);
  if (!name.ok) issues.push("Standard name is missing or too long.");
  if (!description.ok)
    issues.push("Standard description is missing or too long.");

  const threshold = raw.threshold_percent;
  if (
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 100 ||
    Math.round(threshold * 100) !== threshold * 100
  ) {
    issues.push("Threshold must be a number from 0 to 100.");
  }

  if (
    raw.categories.length < LIMITS.minCategories ||
    raw.categories.length > LIMITS.maxCategories
  ) {
    issues.push(
      `Use between ${LIMITS.minCategories} and ${LIMITS.maxCategories} categories.`,
    );
  }

  const seen = new Set<string>();
  let questionTotal = 0;
  const categories: FiveSBuilderProposal["categories"] = [];

  for (const category of raw.categories) {
    const categoryName = boundedText(
      category.name,
      LIMITS.categoryNameMax,
      true,
    );
    const categoryDescription = boundedText(
      category.description,
      LIMITS.descriptionMax,
      false,
    );
    if (!categoryName.ok || !categoryName.value) {
      issues.push("Each category needs a name.");
      continue;
    }
    const key = categoryName.value.toLocaleLowerCase("en-GB");
    if (seen.has(key)) {
      issues.push(`Duplicate category “${categoryName.value}”.`);
    }
    seen.add(key);
    if (
      category.questions.length < LIMITS.minQuestionsPerCategory ||
      category.questions.length > LIMITS.maxQuestionsPerCategory
    ) {
      issues.push(
        `${categoryName.value} needs ${LIMITS.minQuestionsPerCategory}–${LIMITS.maxQuestionsPerCategory} questions.`,
      );
    }
    const questions: FiveSBuilderProposal["categories"][number]["questions"] =
      [];
    for (const question of category.questions) {
      questionTotal += 1;
      const prompt = boundedText(question.prompt, LIMITS.promptMax, true);
      const guidance = boundedText(
        question.guidance,
        LIMITS.guidanceMax,
        false,
      );
      if (!prompt.ok || !prompt.value) {
        issues.push(
          `A question in ${categoryName.value} is empty or too long.`,
        );
        continue;
      }
      if (!QUESTION_TYPES.has(question.question_type)) {
        issues.push(`${categoryName.value} uses an unsupported question type.`);
        continue;
      }
      if (!guidance.ok) {
        issues.push(`Guidance in ${categoryName.value} is too long.`);
        continue;
      }
      questions.push({
        prompt: prompt.value,
        questionType:
          question.question_type as FiveSBuilderProposal["categories"][number]["questions"][number]["questionType"],
        guidance: guidance.value,
      });
    }
    if (categoryName.ok && categoryName.value && categoryDescription.ok) {
      categories.push({
        name: categoryName.value,
        description: categoryDescription.value,
        questions,
      });
    }
  }

  if (questionTotal > LIMITS.maxQuestionsTotal) {
    issues.push(`Use at most ${LIMITS.maxQuestionsTotal} questions.`);
  }

  if (
    issues.length > 0 ||
    !name.ok ||
    !description.ok ||
    !name.value ||
    !description.value
  ) {
    return { ok: false, issues: issues.slice(0, 8) };
  }

  return {
    ok: true,
    proposal: {
      name: name.value,
      description: description.value,
      thresholdPercent: Math.round(threshold * 100) / 100,
      categories,
    },
  };
}

function optionalUnderstanding(value: string | null, max = 400): string | null {
  const parsed = boundedText(value, max, false);
  return parsed.ok ? parsed.value : null;
}

export function parseFiveSBuilderEnvelope(
  value: unknown,
):
  | { ok: true; envelope: ParsedFiveSBuilderEnvelope }
  | { ok: false; issues: string[] } {
  const parsed = rawFiveSBuilderEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: ["LeanAI reply did not match the expected shape."],
    };
  }
  const message = boundedText(parsed.data.message, 2000, true);
  if (!message.ok || !message.value) {
    return { ok: false, issues: ["LeanAI reply did not include a message."] };
  }

  const understanding = {
    environment: optionalUnderstanding(parsed.data.understanding.environment),
    purpose: optionalUnderstanding(parsed.data.understanding.purpose),
    auditStyle: optionalUnderstanding(parsed.data.understanding.audit_style),
    depth: optionalUnderstanding(parsed.data.understanding.depth),
    evidence: optionalUnderstanding(parsed.data.understanding.evidence),
    scoring: optionalUnderstanding(parsed.data.understanding.scoring),
    terminology: optionalUnderstanding(parsed.data.understanding.terminology),
  };

  const questions = parsed.data.questions.slice(0, 3).flatMap((question) => {
    const text = boundedText(question.question, 240, true);
    if (!text.ok || !text.value) {
      return [];
    }
    return [
      {
        question: text.value,
        suggestedAnswers: question.suggested_answers
          .slice(0, 4)
          .flatMap((answer) => {
            const parsedAnswer = boundedText(answer, 80, true);
            return parsedAnswer.ok && parsedAnswer.value
              ? [parsedAnswer.value]
              : [];
          }),
      },
    ];
  });

  const changeSummary = parsed.data.change_summary
    .slice(0, 6)
    .flatMap((item) => {
      const text = boundedText(item, 200, true);
      return text.ok && text.value ? [text.value] : [];
    });

  if (parsed.data.phase === "discovery" || !parsed.data.proposal) {
    return {
      ok: true,
      envelope: {
        message: message.value,
        phase: "discovery",
        understanding,
        questions,
        changeSummary,
        proposal: null,
        proposalStatus: "none",
        proposalIssues: [],
      },
    };
  }

  const proposal = validateFiveSBuilderProposal(parsed.data.proposal);
  if (!proposal.ok) {
    return {
      ok: true,
      envelope: {
        message: message.value,
        phase: "proposal",
        understanding,
        questions,
        changeSummary,
        proposal: null,
        proposalStatus: "invalid",
        proposalIssues: proposal.issues,
      },
    };
  }

  return {
    ok: true,
    envelope: {
      message: message.value,
      phase: "proposal",
      understanding,
      questions,
      changeSummary,
      proposal: proposal.proposal,
      proposalStatus: "valid",
      proposalIssues: [],
    },
  };
}

export function revalidateStoredFiveSProposal(
  value: unknown,
): FiveSBuilderProposal | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as FiveSBuilderProposal;
  const raw = {
    name: record.name,
    description: record.description,
    threshold_percent: record.thresholdPercent,
    categories: (record.categories ?? []).map((category) => ({
      name: category.name,
      description: category.description,
      questions: (category.questions ?? []).map((question) => ({
        prompt: question.prompt,
        question_type: question.questionType,
        guidance: question.guidance,
      })),
    })),
  };
  const parsed = rawFiveSBuilderProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const validated = validateFiveSBuilderProposal(parsed.data);
  return validated.ok ? validated.proposal : null;
}

export function fiveSBuilderProposalToDefinition(
  proposal: FiveSBuilderProposal,
  thresholdPercent: number,
): FiveSDraftDefinition {
  return {
    key: FIVE_S_BUILDER_DECLARED_KEY,
    name: proposal.name,
    description: proposal.description,
    thresholdPercent,
    categories: proposal.categories.map((category) => ({
      name: category.name,
      questions: category.questions.map((question) => ({
        prompt: question.prompt,
        questionType: question.questionType,
        helpText: question.guidance,
      })),
    })),
  };
}
