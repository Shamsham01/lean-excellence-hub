import type { GembaQuickStartTemplate, GembaTemplateCounts } from "./types";

export function gembaTemplateCounts(
  template: GembaQuickStartTemplate,
): GembaTemplateCounts {
  return {
    sections: template.sections.length,
    prompts: template.sections.reduce(
      (count, section) => count + section.prompts.length,
      0,
    ),
  };
}

export function validateGembaQuickStartTemplate(
  template: GembaQuickStartTemplate,
): string[] {
  const issues: string[] = [];
  if (!template.key || !template.name || !template.description) {
    issues.push("Template identity is incomplete.");
  }
  if (
    template.expectedDurationMinutes < 10 ||
    template.expectedDurationMinutes > 240
  ) {
    issues.push("Expected duration must be between 10 and 240 minutes.");
  }
  if (template.sections.length < 1 || template.sections.length > 8) {
    issues.push("Use between 1 and 8 sections.");
  }
  const names = new Set<string>();
  let prompts = 0;
  for (const section of template.sections) {
    const name = section.name.trim().toLocaleLowerCase("en-GB");
    if (!section.name.trim() || section.name.trim().length > 160) {
      issues.push("Each section needs a name of 160 characters or fewer.");
    }
    if (names.has(name)) {
      issues.push(`Duplicate section “${section.name}”.`);
    }
    names.add(name);
    if (section.prompts.length < 1 || section.prompts.length > 5) {
      issues.push(`${section.name} needs between 1 and 5 prompts.`);
    }
    for (const prompt of section.prompts) {
      prompts += 1;
      if (!prompt.prompt.trim() || prompt.prompt.trim().length > 500) {
        issues.push("Each prompt must be 1–500 characters.");
      }
      if (prompt.guidance && prompt.guidance.trim().length > 400) {
        issues.push("Prompt guidance must be 400 characters or fewer.");
      }
    }
  }
  if (prompts > 24) {
    issues.push("A Quick Start walk can contain at most 24 prompts.");
  }
  return issues;
}
