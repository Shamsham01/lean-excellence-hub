import { z } from "zod";

import { boundedText } from "@/modules/module-setup/text";
import type { GembaDraftDefinition } from "@/modules/gemba/templates";

import {
  GEMBA_BUILDER_DECLARED_KEY,
  GEMBA_BUILDER_LIMITS as LIMITS,
  type GembaBuilderProposal,
} from "./types";

const rawPromptSchema = z.object({
  prompt: z.string(),
  guidance: z.string().nullable(),
});

const rawSectionSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  prompts: z.array(rawPromptSchema),
});

export const rawGembaBuilderProposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  sections: z.array(rawSectionSchema),
});

const understandingSchema = z.object({
  purpose: z.string().nullable(),
  environment: z.string().nullable(),
  focus: z.string().nullable(),
  audience: z.string().nullable(),
  depth: z.string().nullable(),
  terminology: z.string().nullable(),
});

export const rawGembaBuilderEnvelopeSchema = z.object({
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
  proposal: rawGembaBuilderProposalSchema.nullable(),
});

export type ParsedGembaBuilderEnvelope = {
  message: string;
  phase: "discovery" | "proposal";
  understanding: Record<string, string | null>;
  questions: Array<{ question: string; suggestedAnswers: string[] }>;
  changeSummary: string[];
  proposal: GembaBuilderProposal | null;
  proposalStatus: "none" | "valid" | "invalid";
  proposalIssues: string[];
};

export function validateGembaBuilderProposal(
  raw: z.infer<typeof rawGembaBuilderProposalSchema>,
):
  | { ok: true; proposal: GembaBuilderProposal }
  | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const name = boundedText(raw.name, LIMITS.nameMax, true);
  const description = boundedText(raw.description, LIMITS.descriptionMax, true);
  if (!name.ok) issues.push("Definition name is missing or too long.");
  if (!description.ok)
    issues.push("Definition description is missing or too long.");

  if (
    raw.sections.length < LIMITS.minSections ||
    raw.sections.length > LIMITS.maxSections
  ) {
    issues.push(
      `Use between ${LIMITS.minSections} and ${LIMITS.maxSections} sections.`,
    );
  }

  const seen = new Set<string>();
  let promptTotal = 0;
  const sections: GembaBuilderProposal["sections"] = [];

  for (const section of raw.sections) {
    const sectionName = boundedText(section.name, LIMITS.sectionNameMax, true);
    const sectionDescription = boundedText(
      section.description,
      LIMITS.descriptionMax,
      false,
    );
    if (!sectionName.ok || !sectionName.value) {
      issues.push("Each section needs a name.");
      continue;
    }
    const key = sectionName.value.toLocaleLowerCase("en-GB");
    if (seen.has(key)) {
      issues.push(`Duplicate section “${sectionName.value}”.`);
    }
    seen.add(key);
    if (
      section.prompts.length < LIMITS.minPromptsPerSection ||
      section.prompts.length > LIMITS.maxPromptsPerSection
    ) {
      issues.push(
        `${sectionName.value} needs ${LIMITS.minPromptsPerSection}–${LIMITS.maxPromptsPerSection} prompts.`,
      );
    }
    const prompts: GembaBuilderProposal["sections"][number]["prompts"] = [];
    for (const prompt of section.prompts) {
      promptTotal += 1;
      const text = boundedText(prompt.prompt, LIMITS.promptMax, true);
      const guidance = boundedText(prompt.guidance, LIMITS.guidanceMax, false);
      if (!text.ok || !text.value) {
        issues.push(`A prompt in ${sectionName.value} is empty or too long.`);
        continue;
      }
      if (!guidance.ok) {
        issues.push(`Guidance in ${sectionName.value} is too long.`);
        continue;
      }
      prompts.push({ prompt: text.value, guidance: guidance.value });
    }
    if (sectionName.ok && sectionName.value && sectionDescription.ok) {
      sections.push({
        name: sectionName.value,
        description: sectionDescription.value,
        prompts,
      });
    }
  }

  if (promptTotal > LIMITS.maxPromptsTotal) {
    issues.push(`Use at most ${LIMITS.maxPromptsTotal} prompts.`);
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
      sections,
    },
  };
}

function optionalUnderstanding(value: string | null): string | null {
  const parsed = boundedText(value, 400, false);
  return parsed.ok ? parsed.value : null;
}

export function parseGembaBuilderEnvelope(
  value: unknown,
):
  | { ok: true; envelope: ParsedGembaBuilderEnvelope }
  | { ok: false; issues: string[] } {
  const parsed = rawGembaBuilderEnvelopeSchema.safeParse(value);
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
    purpose: optionalUnderstanding(parsed.data.understanding.purpose),
    environment: optionalUnderstanding(parsed.data.understanding.environment),
    focus: optionalUnderstanding(parsed.data.understanding.focus),
    audience: optionalUnderstanding(parsed.data.understanding.audience),
    depth: optionalUnderstanding(parsed.data.understanding.depth),
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

  const proposal = validateGembaBuilderProposal(parsed.data.proposal);
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

export function revalidateStoredGembaProposal(
  value: unknown,
): GembaBuilderProposal | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as GembaBuilderProposal;
  const raw = {
    name: record.name,
    description: record.description,
    sections: (record.sections ?? []).map((section) => ({
      name: section.name,
      description: section.description,
      prompts: (section.prompts ?? []).map((prompt) => ({
        prompt: prompt.prompt,
        guidance: prompt.guidance,
      })),
    })),
  };
  const parsed = rawGembaBuilderProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const validated = validateGembaBuilderProposal(parsed.data);
  return validated.ok ? validated.proposal : null;
}

export function gembaBuilderProposalToDefinition(
  proposal: GembaBuilderProposal,
): GembaDraftDefinition {
  return {
    key: GEMBA_BUILDER_DECLARED_KEY,
    name: proposal.name,
    description: proposal.description,
    expectedDurationMinutes: null,
    sections: proposal.sections.map((section) => ({
      name: section.name,
      prompts: section.prompts.map((prompt) => ({
        prompt: prompt.prompt,
        helpText: prompt.guidance,
      })),
    })),
  };
}
