import "server-only";

import {
  ACTIONS_PERMISSIONS,
  BENEFITS_PERMISSIONS,
  FIVE_S_PERMISSIONS,
  GEMBA_PERMISSIONS,
  SKILLS_PERMISSIONS,
  TRAINING_PERMISSIONS,
} from "@/modules/operational/permissions";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";

import type { ModuleInsightsKey } from "./module-insights-request";

export async function canFetchModulePageInsights(
  insightsModule: ModuleInsightsKey,
): Promise<boolean> {
  switch (insightsModule) {
    case "actions":
      return currentMemberHasPermission(ACTIONS_PERMISSIONS.read);
    case "benefits":
      return currentMemberHasPermission(BENEFITS_PERMISSIONS.read);
    case "five-s":
      return currentMemberHasPermission(FIVE_S_PERMISSIONS.read);
    case "gemba":
      return currentMemberHasPermission(GEMBA_PERMISSIONS.read);
    case "problem-solving":
      return currentMemberHasPermission("problem_solving.view");
    case "skills":
      return currentMemberHasPermission(SKILLS_PERMISSIONS.read);
    case "suggestions": {
      const [canReadPortfolio, canSubmit] = await Promise.all([
        currentMemberHasGrantPermission("suggestions.read"),
        currentMemberHasPermission("suggestions.submit"),
      ]);
      return canReadPortfolio || canSubmit;
    }
    case "training":
      return currentMemberHasPermission(TRAINING_PERMISSIONS.read);
    default: {
      const exhaustive: never = insightsModule;
      return exhaustive;
    }
  }
}
