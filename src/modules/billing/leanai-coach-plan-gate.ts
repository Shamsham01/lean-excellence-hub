import type { PlanModuleCode } from "./module-entitlements";

const LEANAI_MODULE_TO_PLAN: Record<string, PlanModuleCode> = {
  maturity: "maturity",
  five_s: "five_s",
  gemba: "gemba",
  suggestions: "suggestions",
  projects: "projects",
  benefits: "benefits",
  problem_solving: "problem_solving",
  training: "training",
  skills: "skills",
  recognition: "recognition",
  people: "people_hr",
  schedule: "schedule",
  templates: "templates",
};

export function planModuleForLeanAiCoachModule(
  moduleKey: string,
): PlanModuleCode | null {
  return LEANAI_MODULE_TO_PLAN[moduleKey] ?? null;
}
