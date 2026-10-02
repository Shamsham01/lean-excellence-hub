import { selectPrimaryLeanAiIntervention } from "@/modules/leanai-context/interventions/engine";
import type {
  LeanAiCoachSurface,
  LeanAiInterventionCandidate,
} from "@/modules/leanai-context/interventions/types";
import type { LeanAiContextualSnapshot } from "@/modules/leanai-context/types";

/**
 * Prefer a page-specific setup gap when the user is already on that module.
 * Otherwise return the next workspace-level incomplete area. Zero model cost.
 */
export function selectAssistantIntervention(input: {
  snapshot: LeanAiContextualSnapshot;
  permissions: Record<string, boolean>;
  pageSurface: LeanAiCoachSurface;
  now?: Date;
}): LeanAiInterventionCandidate | null {
  const nowOption = input.now ? { now: input.now } : {};
  const pageSpecific = selectPrimaryLeanAiIntervention({
    snapshot: input.snapshot,
    permissions: input.permissions,
    surface: input.pageSurface,
    ...nowOption,
  });
  if (pageSpecific) {
    return pageSpecific;
  }
  if (
    input.pageSurface === "workspace" ||
    input.pageSurface === "platform_home" ||
    input.pageSurface === "setup"
  ) {
    return null;
  }
  return selectPrimaryLeanAiIntervention({
    snapshot: input.snapshot,
    permissions: input.permissions,
    surface: "workspace",
    ...nowOption,
  });
}
