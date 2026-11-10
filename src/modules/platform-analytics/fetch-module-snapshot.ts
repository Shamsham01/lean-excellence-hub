"use server";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import type { AnalyticsDateRange } from "./date-range";
import { loadActionsAnalytics } from "./actions";
import { loadBenefitsAnalytics } from "./benefits";
import { loadFiveSAnalytics } from "./five-s";
import { loadGembaAnalytics } from "./gemba";
import { loadProblemSolvingAnalytics } from "./problem-solving";
import { loadSkillsAnalytics } from "./skills";
import { loadSuggestionsAnalytics } from "./suggestions";
import { loadTrainingAnalytics } from "./training";
import type { ModuleAnalyticsSnapshot } from "./types";

export type ModuleInsightsKey =
  | "actions"
  | "benefits"
  | "five-s"
  | "gemba"
  | "problem-solving"
  | "skills"
  | "suggestions"
  | "training";

export async function fetchModulePageInsightsSnapshot(
  module: ModuleInsightsKey,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const supabase = await createServerSupabaseClient();
  switch (module) {
    case "actions":
      return loadActionsAnalytics(supabase, range);
    case "benefits":
      return loadBenefitsAnalytics(supabase, range);
    case "five-s":
      return loadFiveSAnalytics(supabase, range);
    case "gemba":
      return loadGembaAnalytics(supabase, range);
    case "problem-solving":
      return loadProblemSolvingAnalytics(supabase, range);
    case "skills":
      return loadSkillsAnalytics(supabase);
    case "suggestions":
      return loadSuggestionsAnalytics(supabase, range);
    case "training":
      return loadTrainingAnalytics(supabase, range);
    default: {
      const exhaustive: never = module;
      throw new Error(`Unsupported module insights key: ${exhaustive}`);
    }
  }
}
