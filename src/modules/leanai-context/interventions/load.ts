import "server-only";

import { cache } from "react";

import {
  currentMemberHasPermission,
  prefetchMemberPermissions,
} from "@/modules/platform-shell/permissions";

import { loadLeanAiContextualSnapshot } from "../queries";
import { LEANAI_INTERVENTION_PERMISSION_KEYS } from "./catalogue";
import { selectPrimaryLeanAiIntervention } from "./engine";
import type { LeanAiCoachSurface, LeanAiInterventionCandidate } from "./types";

export async function loadLeanAiInterventionPermissions(): Promise<
  Record<string, boolean>
> {
  await prefetchMemberPermissions([...LEANAI_INTERVENTION_PERMISSION_KEYS]);
  const entries = await Promise.all(
    LEANAI_INTERVENTION_PERMISSION_KEYS.map(
      async (permissionKey) =>
        [
          permissionKey,
          await currentMemberHasPermission(permissionKey),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export const loadLeanAiCoachView = cache(
  async (
    surface: LeanAiCoachSurface,
  ): Promise<{
    recommendation: LeanAiInterventionCandidate | null;
    applicationAiAvailable: boolean;
  }> => {
    try {
      const [snapshot, permissions] = await Promise.all([
        loadLeanAiContextualSnapshot(),
        loadLeanAiInterventionPermissions(),
      ]);
      return {
        recommendation: selectPrimaryLeanAiIntervention({
          snapshot,
          permissions,
          surface,
        }),
        applicationAiAvailable: snapshot.applicationAiAvailable,
      };
    } catch {
      return { recommendation: null, applicationAiAvailable: false };
    }
  },
);

export const loadLeanAiCoachRecommendation = cache(
  async (
    surface: LeanAiCoachSurface,
  ): Promise<LeanAiInterventionCandidate | null> => {
    const view = await loadLeanAiCoachView(surface);
    return view.recommendation;
  },
);
