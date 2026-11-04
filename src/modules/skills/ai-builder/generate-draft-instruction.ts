export const SKILLS_GENERATE_DRAFT_INSTRUCTION =
  "Generate a draft Skills proposal from the available details. State assumptions and unresolved questions in notes. Do not assess anyone, invent competence, or publish.";

export function buildSkillsGenerateDraftRequest(input: {
  originalDescription: string;
  guidedAnswers: string;
}): string {
  const parts = [SKILLS_GENERATE_DRAFT_INSTRUCTION];
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
