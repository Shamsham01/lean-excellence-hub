import { LEH_OPERATIONAL_GEMBA_WALK } from "./leh-operational-gemba-walk";
import type { GembaQuickStartTemplate } from "./types";
import { validateGembaQuickStartTemplate } from "./validation";

const CATALOGUE: readonly GembaQuickStartTemplate[] = [
  LEH_OPERATIONAL_GEMBA_WALK,
];

export function listGembaQuickStartTemplates(): readonly GembaQuickStartTemplate[] {
  return CATALOGUE;
}

export function isGembaQuickStartTemplateKey(
  key: string,
): key is GembaQuickStartTemplate["key"] {
  return CATALOGUE.some((template) => template.key === key);
}

export function getGembaQuickStartTemplate(
  key: string,
): GembaQuickStartTemplate | null {
  return CATALOGUE.find((template) => template.key === key) ?? null;
}

export function requireCanonicalGembaTemplate(
  key: string,
): GembaQuickStartTemplate {
  const template = getGembaQuickStartTemplate(key);
  if (!template) {
    throw new Error("Unknown Gemba Quick Start template.");
  }
  const issues = validateGembaQuickStartTemplate(template);
  if (issues.length > 0) {
    throw new Error(issues[0] ?? "Gemba Quick Start template is invalid.");
  }
  return template;
}
