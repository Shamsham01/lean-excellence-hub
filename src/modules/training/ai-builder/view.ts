import type { ModuleSetupBuilderSnapshot } from "@/modules/module-setup/ai-builder/snapshot";
import type { ModuleSetupBuilderConversationState } from "@/modules/module-setup/ai-builder/types";

import type { TrainingBuilderProposal } from "./types";

const UNDERSTANDING_FIELDS = [
  ["operation", "Operation"],
  ["audience", "Audience"],
  ["delivery", "Delivery"],
  ["compliance", "Compliance"],
  ["curriculum", "Curriculum"],
] as const;

export function trainingBuilderSnapshot(
  conversation: ModuleSetupBuilderConversationState<TrainingBuilderProposal>,
): ModuleSetupBuilderSnapshot {
  const understanding = UNDERSTANDING_FIELDS.flatMap(([key, label]) => {
    const value = conversation.understanding?.[key];
    return value ? [{ label, value }] : [];
  });
  const proposal = conversation.currentProposal;
  return {
    turns: conversation.turns.map((turn) =>
      turn.role === "user"
        ? { id: turn.id, role: "user", text: turn.text }
        : {
            id: turn.id,
            role: "assistant",
            message: turn.message,
            questions: turn.questions,
            proposalStatus: turn.proposalStatus,
            proposalIssues: turn.proposalIssues,
            responseStatus: turn.responseStatus,
          },
    ),
    pendingQuestions: conversation.pendingQuestions,
    lastTurnInvalid: conversation.lastTurnInvalid,
    understanding,
    proposal: proposal
      ? {
          messageId: proposal.messageId,
          revision: proposal.revision,
          name: proposal.proposal.title,
          description:
            proposal.proposal.curriculum?.description ??
            proposal.proposal.courses[0]?.description ??
            "Training catalogue draft",
          thresholdPercent: null,
          changeSummary: proposal.changeSummary,
          sections: proposal.proposal.courses.map((course) => ({
            name: course.name,
            description: course.category,
            items: [
              {
                prompt: course.learningObjectives ?? course.description ?? "",
                typeLabel: course.deliveryMethod,
              },
            ],
          })),
        }
      : null,
  };
}
