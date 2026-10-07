import type { ModuleSetupBuilderConversationState } from "@/modules/module-setup/ai-builder/types";
import type { ModuleSetupBuilderSnapshot } from "@/modules/module-setup/ai-builder/snapshot";
import { fiveSQuestionTypeLabel } from "@/modules/5s/templates";

import {
  FIVE_S_UNDERSTANDING_FIELDS,
  type FiveSBuilderProposal,
} from "./types";

export function fiveSBuilderSnapshot(
  conversation: ModuleSetupBuilderConversationState<FiveSBuilderProposal>,
): ModuleSetupBuilderSnapshot {
  const understanding = FIVE_S_UNDERSTANDING_FIELDS.flatMap(([key, label]) => {
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
          name: proposal.proposal.name,
          description: proposal.proposal.description,
          thresholdPercent: proposal.proposal.thresholdPercent,
          changeSummary: proposal.changeSummary,
          sections: proposal.proposal.categories.map((category) => ({
            name: category.name,
            description: category.description,
            items: category.questions.map((question) => ({
              prompt: question.prompt,
              typeLabel: fiveSQuestionTypeLabel(question.questionType),
            })),
          })),
        }
      : null,
  };
}
