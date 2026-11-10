"use server";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import { loadActionsAnalytics } from "./actions";
import { loadBenefitsAnalytics } from "./benefits";
import { buildAnalyticsDateRangeForOrganisation } from "./date-range.server";
import { loadFiveSAnalytics } from "./five-s";
import { loadGembaAnalytics } from "./gemba";
import { canFetchModulePageInsights } from "./module-insights-access";
import {
  emptyModuleAnalyticsSnapshot,
  parseModuleInsightsKey,
  parseTrustedModuleInsightsDays,
  type ModuleInsightsKey,
} from "./module-insights-request";
import { loadProblemSolvingAnalytics } from "./problem-solving";
import { loadSkillsAnalytics } from "./skills";
import { loadSuggestionsAnalytics } from "./suggestions";
import { loadTrainingAnalytics } from "./training";
import type { ModuleAnalyticsSnapshot } from "./types";

export type { ModuleInsightsKey } from "./module-insights-request";

export async function fetchModulePageInsightsSnapshot(
  moduleInput: unknown,
  daysInput: unknown,
): Promise<ModuleAnalyticsSnapshot> {
  const insightsModule = parseModuleInsightsKey(moduleInput);
  const days = parseTrustedModuleInsightsDays(daysInput);
  if (!insightsModule || days === null) {
    return emptyModuleAnalyticsSnapshot();
  }

  if (!(await canFetchModulePageInsights(insightsModule))) {
    return emptyModuleAnalyticsSnapshot();
  }

  const range = await buildAnalyticsDateRangeForOrganisation(days);
  const supabase = await createServerSupabaseClient();

  switch (insightsModule) {
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
      return emptyModuleAnalyticsSnapshot();
    }
  }
}
