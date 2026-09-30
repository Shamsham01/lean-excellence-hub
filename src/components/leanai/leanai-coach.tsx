import { LeanAiCoachCard } from "@/components/leanai/leanai-coach-card";
import { loadLeanAiCoachRecommendation } from "@/modules/leanai-context/interventions/load";
import type {
  LeanAiCoachPresentation,
  LeanAiCoachSurface,
} from "@/modules/leanai-context/interventions/types";

export async function LeanAiCoach({
  surface,
  presentation = "card",
}: {
  surface: LeanAiCoachSurface;
  presentation?: LeanAiCoachPresentation;
}) {
  const recommendation = await loadLeanAiCoachRecommendation(surface);
  if (!recommendation) {
    return null;
  }

  return (
    <LeanAiCoachCard
      recommendation={recommendation}
      presentation={presentation}
    />
  );
}
