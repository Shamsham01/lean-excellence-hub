import type { GembaDraftDefinition, GembaQuickStartTemplate } from "./types";

export function buildGembaQuickStartDefinition(
  template: GembaQuickStartTemplate,
): GembaDraftDefinition {
  return {
    key: template.key,
    name: template.name,
    description: template.description,
    expectedDurationMinutes: template.expectedDurationMinutes,
    sections: template.sections.map((section) => ({
      name: section.name,
      prompts: section.prompts.map((prompt) => ({
        prompt: prompt.prompt,
        helpText: prompt.guidance?.trim() ? prompt.guidance.trim() : null,
      })),
    })),
  };
}
