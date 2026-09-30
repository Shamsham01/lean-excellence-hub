import { LeanAiCoachCard } from "@/components/leanai/leanai-coach-card";
import { loadLeanAiCoachView } from "@/modules/leanai-context/interventions/load";
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
  const { recommendation, applicationAiAvailable } =
    await loadLeanAiCoachView(surface);
  if (!recommendation) {
    return null;
  }

  return (
    <LeanAiCoachCard
      key={`${recommendation.organisationId}:${recommendation.key}`}
      recommendation={recommendation}
      presentation={presentation}
      surface={surface}
      applicationAiAvailable={applicationAiAvailable}
    />
  );
}
