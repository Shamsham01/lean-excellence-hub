export const TRAINING_GENERATE_DRAFT_INSTRUCTION =
  "Generate a draft Training catalogue proposal from the available details. State assumptions and unresolved questions in notes. Do not schedule sessions, mark anyone complete, or publish.";

export function buildTrainingGenerateDraftRequest(input: {
  originalDescription: string;
  guidedAnswers: string;
}): string {
  const parts = [TRAINING_GENERATE_DRAFT_INSTRUCTION];
  const original = input.originalDescription.trim();
  const guided = input.guidedAnswers.trim();
  if (original) {
    parts.push(`Original description:\n${original}`);
  }
  if (guided && guided !== original) {
    parts.push(guided);
  }
  return parts.join("\n\n");
}
