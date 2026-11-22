import type { AssistantRelevantState } from "@/modules/leanai-context/assistant/types";

export function buildSkillsLiveAssistantState(
  input:
    | { canReadSkills: false }
    | {
        canReadSkills: true;
        activeSkillCount: number;
        draftSkillCount: number;
        publishedStandardCount: number;
      },
): AssistantRelevantState {
  if (!input.canReadSkills) {
    return {
      skillsConfigurationVisible: false,
    };
  }
  return {
    skillsConfigurationVisible: true,
    activeSkillCount: input.activeSkillCount,
    draftSkillCount: input.draftSkillCount,
    publishedStandardCount: input.publishedStandardCount,
  };
}
