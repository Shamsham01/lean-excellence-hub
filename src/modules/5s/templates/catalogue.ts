import { LEH_WORKPLACE_5S_STANDARD } from "./leh-workplace-5s-standard";
import type { FiveSQuickStartTemplate } from "./types";
import { validateFiveSQuickStartTemplate } from "./validation";

const CATALOGUE: readonly FiveSQuickStartTemplate[] = [
  LEH_WORKPLACE_5S_STANDARD,
];

export function listFiveSQuickStartTemplates(): readonly FiveSQuickStartTemplate[] {
  return CATALOGUE;
}

export function isFiveSQuickStartTemplateKey(
  key: string,
): key is FiveSQuickStartTemplate["key"] {
  return CATALOGUE.some((template) => template.key === key);
}

export function getFiveSQuickStartTemplate(
  key: string,
): FiveSQuickStartTemplate | null {
  return CATALOGUE.find((template) => template.key === key) ?? null;
}

/** Server-owned catalogue entry. Unknown keys are rejected, never repaired. */
export function requireCanonicalFiveSTemplate(
  key: string,
): FiveSQuickStartTemplate {
  const template = getFiveSQuickStartTemplate(key);
  if (!template) {
    throw new Error("Unknown 5S Quick Start template.");
  }
  const issues = validateFiveSQuickStartTemplate(template);
  if (issues.length > 0) {
    throw new Error(issues[0] ?? "5S Quick Start template is invalid.");
  }
  return template;
}
