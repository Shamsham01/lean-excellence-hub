import { LEH_OPERATIONAL_EXCELLENCE_STANDARD } from "./leh-operational-excellence-standard";
import {
  LEH_OE_STANDARD_EXPECTED_COUNTS,
  LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
  type MaturityFrameworkTemplate,
} from "./types";
import {
  assertLehOperationalExcellenceCompleteness,
  validateMaturityFrameworkTemplate,
} from "./validation";

const MATURITY_FRAMEWORK_TEMPLATES: readonly MaturityFrameworkTemplate[] = [
  LEH_OPERATIONAL_EXCELLENCE_STANDARD,
];

const TEMPLATES_BY_KEY = new Map(
  MATURITY_FRAMEWORK_TEMPLATES.map((template) => [template.key, template]),
);

export const MATURITY_QUICK_START_TEMPLATE_KEYS = [
  LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
] as const;

export type MaturityQuickStartTemplateKey =
  (typeof MATURITY_QUICK_START_TEMPLATE_KEYS)[number];

export function listMaturityFrameworkTemplates(): readonly MaturityFrameworkTemplate[] {
  return MATURITY_FRAMEWORK_TEMPLATES;
}

export function getMaturityFrameworkTemplate(
  key: string,
): MaturityFrameworkTemplate | null {
  return TEMPLATES_BY_KEY.get(key) ?? null;
}

export function isMaturityQuickStartTemplateKey(
  key: string,
): key is MaturityQuickStartTemplateKey {
  return TEMPLATES_BY_KEY.has(key);
}

export function requireCanonicalMaturityTemplate(
  key: string,
): MaturityFrameworkTemplate {
  const template = getMaturityFrameworkTemplate(key);
  if (!template) {
    throw new Error(`Unknown maturity Quick Start template: ${key}`);
  }
  const issues =
    template.key === LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY
      ? assertLehOperationalExcellenceCompleteness(template)
      : validateMaturityFrameworkTemplate(template);
  if (issues.length > 0) {
    throw new Error(
      `Built-in maturity template "${template.key}" failed validation: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return template;
}

export {
  LEH_OE_STANDARD_EXPECTED_COUNTS,
  LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
};
