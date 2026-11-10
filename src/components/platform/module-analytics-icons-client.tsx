"use client";

import type { LucideIcon } from "lucide-react";

import {
  ACTION_ANALYTICS_ICONS,
  BENEFITS_ANALYTICS_ICONS,
  FIVE_S_ANALYTICS_ICONS,
  GEMBA_ANALYTICS_ICONS,
  PPS_ANALYTICS_ICONS,
  SKILLS_ANALYTICS_ICONS,
  SUGGESTION_ANALYTICS_ICONS,
  TRAINING_ANALYTICS_ICONS,
} from "@/components/platform/module-analytics-icons";
import type { ModuleInsightsKey } from "@/modules/platform-analytics/fetch-module-snapshot";

export const MODULE_INSIGHTS_ICON_MAP: Record<
  ModuleInsightsKey,
  Record<string, LucideIcon>
> = {
  actions: ACTION_ANALYTICS_ICONS,
  benefits: BENEFITS_ANALYTICS_ICONS,
  "five-s": FIVE_S_ANALYTICS_ICONS,
  gemba: GEMBA_ANALYTICS_ICONS,
  "problem-solving": PPS_ANALYTICS_ICONS,
  skills: SKILLS_ANALYTICS_ICONS,
  suggestions: SUGGESTION_ANALYTICS_ICONS,
  training: TRAINING_ANALYTICS_ICONS,
};
