import {
  ACTIONS_PERMISSIONS,
  SUGGESTIONS_PERMISSIONS,
} from "@/modules/operational/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import type { PlatformKnowledgeModuleKey } from "./contract";

const SENSITIVE_LINE =
  /(draft count|unpublished|admin|billing|invoice|capacity|assignee|salary|payroll)/i;

const MODULE_MANAGE_PERMISSION: Partial<
  Record<PlatformKnowledgeModuleKey, string>
> = {
  maturity: MATURITY_PERMISSIONS.modelsManage,
  suggestions: SUGGESTIONS_PERMISSIONS.programmesManage,
  actions: ACTIONS_PERMISSIONS.update,
  training: "training.catalog.manage",
  people: "job_functions.manage",
  five_s: "five_s.standards.manage",
  gemba: "gemba.definitions.manage",
  recognition: "recognition.manage",
  projects: "projects.manage",
  benefits: "benefits.manage",
  billing_administration: "billing.manage",
};

/**
 * Drops live configuration lines the member is not allowed to act on,
 * and never injects cross-tenant or withheld counts.
 */
export function filterLiveStateSummaryForKnowledge(input: {
  module: PlatformKnowledgeModuleKey | null;
  summary: string | null | undefined;
  permissions: Readonly<Record<string, boolean>>;
}): string | null {
  const raw = input.summary?.trim();
  if (!raw) {
    return null;
  }

  const manageKey = input.module
    ? MODULE_MANAGE_PERMISSION[input.module]
    : undefined;
  const canManage = manageKey ? Boolean(input.permissions[manageKey]) : false;

  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (!SENSITIVE_LINE.test(line)) {
        return true;
      }
      return canManage;
    });

  if (lines.length === 0) {
    return "You can read product guidance on this page. Live configuration detail is limited to your current permissions.";
  }

  return lines.join(" ");
}
