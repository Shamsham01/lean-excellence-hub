import type { MaturityBuilderDiscoveryQuestion } from "@/modules/maturity/ai-builder/types";

export type GuidedAnswerSelection = {
  question: string;
  answer: string;
};

/**
 * One selected answer per question, in the order LeanAI asked them.
 * An answer is included only when it is still one of that question's options,
 * so a refreshed question cannot inherit a stale choice.
 */
export function orderedGuidedSelections(
  questions: readonly MaturityBuilderDiscoveryQuestion[],
  selected: Readonly<Record<string, string>>,
): GuidedAnswerSelection[] {
  const selections: GuidedAnswerSelection[] = [];
  for (const question of questions) {
    const answer = selected[question.question];
    if (!answer || !question.suggestedAnswers.includes(answer)) {
      continue;
    }
    selections.push({ question: question.question, answer });
  }
  return selections;
}

/** Keep answers whose question text and option still exist. Drop everything else. */
export function pruneGuidedSelections(
  questions: readonly MaturityBuilderDiscoveryQuestion[],
  selected: Readonly<Record<string, string>>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const selection of orderedGuidedSelections(questions, selected)) {
    next[selection.question] = selection.answer;
  }
  return next;
}

/**
 * Serialise guided choices and optional notes at submit time.
 * Notes alone stay plain text so a free-form reply is unchanged.
 */
export function composeGuidedAnswerMessage(input: {
  selections: readonly GuidedAnswerSelection[];
  notes: string;
}): string {
  const notes = input.notes.trim();
  const blocks = input.selections.map(
    (selection) =>
      `Question: ${selection.question}\nAnswer: ${selection.answer}`,
  );
  if (notes.length > 0) {
    blocks.push(
      blocks.length > 0 ? `Additional instructions:\n${notes}` : notes,
    );
  }
  return blocks.join("\n\n");
}
