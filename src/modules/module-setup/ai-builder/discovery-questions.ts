import type { ModuleSetupDiscoveryQuestion } from "./types";

export const MODULE_SETUP_MAX_DISCOVERY_QUESTIONS = 3;
export const MODULE_SETUP_MAX_SUGGESTED_ANSWERS = 4;

export function normalizeModuleSetupDiscoveryQuestions(
  questions: ReadonlyArray<{
    question: string;
    suggestedAnswers?: readonly string[];
    suggested_answers?: readonly string[];
  }>,
): ModuleSetupDiscoveryQuestion[] {
  return questions
    .slice(0, MODULE_SETUP_MAX_DISCOVERY_QUESTIONS)
    .flatMap((entry) => {
      const question = entry.question.trim();
      if (!question) {
        return [];
      }
      const answers = (entry.suggestedAnswers ?? entry.suggested_answers ?? [])
        .map((answer) => answer.trim())
        .filter((answer) => answer.length > 0)
        .slice(0, MODULE_SETUP_MAX_SUGGESTED_ANSWERS);
      return [{ question, suggestedAnswers: answers }];
    });
}
